import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium, expect, type Browser, type Page } from "@playwright/test";

// A real React form with fake actions: no app server, account, cookie, or database.
const root = fileURLToPath(new URL("../../", import.meta.url));
const fixtureSource = [
  "import React, {useState, startTransition} from 'react';",
  "import {createRoot} from 'react-dom/client';",
  "import {ProviderProfileForm} from '@/components/providers/provider-profile-form';",
  "const category='11111111-2222-4333-8444-555555555551', language='11111111-2222-4333-8444-555555555552', specialty='11111111-2222-4333-8444-555555555553';",
  "const initial={id:'11111111-2222-4333-8444-555555555554',revision:'2',details_revision:'1',serviceRegionIds:[],category_id:category,business_name:'Fixture business',display_name:'Fixture provider',bio:'First line\\nSecond line',phone:'555-0100',email:'fixture@example.invalid',website_url:'',city:'Ottawa',province_state:'ON',country:'Canada',profile_image_path:null,profile_image_url:null,status:'active',review_status:null,languageIds:[language],specialtyIds:[specialty]};",
  "function Fixture({options}){const [profile,setProfile]=useState({...initial,...options});window.__profile=profile;window.__refresh=(next)=>startTransition(()=>setProfile(next));return <ProviderProfileForm profile={profile} categories={[{id:category,name:'Inspection',slug:'inspection'}]} languages={[{id:language,name:'English',slug:'en'}]} specialties={[{id:specialty,category_id:category,name:'Residential',slug:'residential'}]} accountId={'11111111-2222-4333-8444-555555555555'} accountEmail={'fixture@example.invalid'} accountFullName={'Fixture provider'} />;}",
  "window.__save=async(previous,data)=>{window.__calls++;const values=Object.fromEntries(data.entries());window.__submitted=values;if(window.__hold)await new Promise(resolve=>window.__release=resolve);await new Promise(resolve=>setTimeout(resolve,15));if(window.__failNext){window.__failNext=false;return {...previous,status:'error',message:'Please fix the email.',fieldErrors:{email:'Invalid email'}};}const active=window.__profile.status==='active';const next={...window.__profile,revision:String(BigInt(window.__profile.revision)+1n),details_revision:String(BigInt(window.__profile.details_revision)+1n),status:active?'active':'pending_approval',review_status:active?'pending_edit':null,display_name:values.fullName,business_name:values.businessName,bio:values.bio,phone:values.phone,email:values.email,website_url:values.websiteUrl,city:values.city,province_state:values.province,country:values.country,category_id:values.categoryId,languageIds:data.getAll('languageIds'),specialtyIds:data.getAll('specialtyIds')};if(window.__timing==='before')window.__refresh(next);if(window.__timing==='after')setTimeout(()=>window.__refresh(next),10);return {status:'success',message:'Saved for review.',fieldErrors:{},revision:next.details_revision,listingRevision:next.revision,listingStatus:next.status,reviewStatus:next.review_status,alreadyPending:false};};",
  "window.__mount=(options)=>{window.__calls=0;window.__timing=options.timing||'before';createRoot(document.getElementById('root')).render(<Fixture options={options}/>);};",
].join("\n");

let browser: Browser | undefined;
let bundle = "";
before(async () => {
  const result = await build({
    stdin: { contents: fixtureSource, loader: "tsx", resolveDir: root },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
    tsconfig: root + "tsconfig.json", metafile: true,
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [{
      name: "isolated-form-actions",
      setup(builder) {
        builder.onResolve({ filter: /^@\/app\/provider\/dashboard\/actions$/ }, () => ({ path: "actions", namespace: "fixture" }));
        builder.onResolve({ filter: /^@\/lib\/supabase\/client$/ }, () => ({ path: "client", namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({
          contents: args.path === "actions"
            ? "export const saveProviderProfile=(...args)=>window.__save(...args);"
            : "export const getSupabaseClient=()=>{throw new Error('Uploads are outside this fixture');};",
          loader: "js",
        }));
      },
    }],
  });
  assert.ok(Object.keys(result.metafile.inputs).some(path => path.endsWith("components/providers/provider-profile-form.tsx")));
  bundle = result.outputFiles[0].text;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); });

async function withFixture(options: Record<string, unknown>, run: (page: Page) => Promise<void>) {
  assert.ok(browser);
  const page = await browser.newPage();
  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));
  await page.route("**/*", route => route.abort());
  try {
    await page.setContent("<!doctype html><html><body><div id='root'></div></body></html>");
    await page.addScriptTag({ content: bundle });
    await page.evaluate("window.__mount(" + JSON.stringify(options) + ")");
    await expect(page.getByRole("textbox", { name: "Bio", exact: true })).toBeVisible();
    await run(page);
    assert.equal(page.url(), "about:blank");
    assert.deepEqual(requests, []);
  } finally { await page.close(); }
}
const submit = (page: Page) => page.getByRole("button", { name: "Submit for approval", exact: true });

test("pending details enable on edit and disable again when the original text is restored", async () => {
  await withFixture({ status: "pending_approval" }, async page => {
    await expect(submit(page)).toBeDisabled();
    await page.getByRole("textbox", { name: "Bio", exact: true }).fill("Changed biography");
    await expect(submit(page)).toBeEnabled();
    await page.getByRole("textbox", { name: "Bio", exact: true }).fill("First line\nSecond line");
    await expect(submit(page)).toBeDisabled();
  });
});

for (const timing of ["before", "after", "none"]) {
  test("successful pending edit disables immediately with refreshed props " + timing + " the action result", async () => {
    await withFixture({ timing }, async page => {
      await expect(submit(page)).toBeDisabled();
      for (let index = 0; index < 3; index++) {
        await page.getByRole("textbox", { name: "Bio", exact: true }).fill("Edited line one\nEdited line two " + index);
        await expect(submit(page)).toBeEnabled();
        await submit(page).click();
        await expect(page.getByRole("status").filter({ hasText: "Saved for review." })).toBeVisible();
        await expect(submit(page)).toBeDisabled();
      }
    });
  });
}

test("first approval submission becomes disabled without a page refresh", async () => {
  await withFixture({ status: "draft" }, async page => {
    await expect(submit(page)).toBeEnabled();
    await submit(page).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved for review." })).toBeVisible();
    await expect(submit(page)).toBeDisabled();
  });
});

test("an edit typed during a request remains unsaved after that request succeeds", async () => {
  await withFixture({}, async page => {
    await page.getByRole("textbox", { name: "Bio", exact: true }).fill("Submitted biography");
    await page.evaluate("window.__hold=true");
    await submit(page).click();
    await page.getByRole("textbox", { name: "Bio", exact: true }).fill("Typed while saving");
    await page.evaluate("window.__release()");
    await expect(page.getByRole("status").filter({ hasText: "Saved for review." })).toBeVisible();
    await expect(submit(page)).toBeEnabled();
    await page.getByRole("textbox", { name: "Bio", exact: true }).fill("Submitted biography");
    await expect(submit(page)).toBeDisabled();
  });
});

test("failed requests retain edits and do not advance the submitted baseline", async () => {
  await withFixture({ status: "pending_approval" }, async page => {
    await page.getByRole("textbox", { name: "Bio", exact: true }).fill("Unsent correction");
    await page.evaluate("window.__failNext=true");
    await submit(page).click();
    await expect(page.getByRole("alert").filter({ hasText: "Please fix the email." })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Bio", exact: true })).toHaveValue("Unsent correction");
    await expect(submit(page)).toBeEnabled();
    await page.getByRole("textbox", { name: "Bio", exact: true }).fill("First line\nSecond line");
    await expect(submit(page)).toBeDisabled();
  });
});

test("controlled specialty selections are not silently omitted from a successful submission", async () => {
  await withFixture({ status: "pending_approval", specialtyIds: ["11111111-2222-4333-8444-555555555553", "11111111-2222-4333-8444-555555555559"] }, async page => {
    await page.getByRole("textbox", { name: "Bio", exact: true }).fill("Edited with a saved specialty");
    await submit(page).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved for review." })).toBeVisible();
    await expect(submit(page)).toBeDisabled();
  });
});

test("unavailable saved specialties can be removed and the resulting submission disables immediately", async () => {
  await withFixture({ status: "pending_approval", specialtyIds: ["11111111-2222-4333-8444-555555555553", "11111111-2222-4333-8444-555555555559"] }, async page => {
    await expect(submit(page)).toBeDisabled();
    await page.getByRole("button", { name: "Remove unavailable specialty", exact: true }).click();
    await expect(submit(page)).toBeEnabled();
    await submit(page).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved for review." })).toBeVisible();
    await expect(submit(page)).toBeDisabled();
  });
});
