import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const migrationDirectory = new URL("../supabase/migrations/", import.meta.url);
const migrations = readdirSync(migrationDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => ({
    name,
    sql: readFileSync(new URL(name, migrationDirectory), "utf8"),
  }));

// Check the final definition after replaying migrations, rather than allowing a
// safe historical definition to hide an unsafe replacement later in history.
const functions = new Map<string, string>();
for (const { sql } of migrations) {
  for (const match of sql.matchAll(
    /create(?: or replace)? function public\.([a-z_]+)\s*\([\s\S]*?\$\$;/gi,
  )) {
    functions.set(match[1], match[0]);
  }
}

const adminFunctions = [
  "moderate_provider_rating",
  "get_admin_provider_ratings",
  "get_admin_platform_growth_counts",
  "get_admin_platform_feedback",
  "update_platform_feedback",
];

for (const name of adminFunctions) {
  test(`${name} rejects authenticated users without an admin profile`, () => {
    const definition = functions.get(name);
    assert.ok(definition, `${name} must exist`);
    assert.match(definition, /security definer/i);
    assert.match(definition, /set search_path = ''/i);
    assert.match(definition, /if current_user_id is null then/i);
    assert.match(
      definition,
      /if current_profile_role is distinct from 'admin'::public\.profile_role then\s+raise exception 'insufficient_role'/i,
    );
    assert.doesNotMatch(definition, /if current_profile_role <>/i);
  });
}

for (const name of ["upsert_provider_rating", "remove_provider_rating"]) {
  test(`${name} rejects a missing profile before inspecting ratings`, () => {
    const definition = functions.get(name);
    assert.ok(definition);
    assert.match(
      definition,
      /if profile_role is null or profile_role not in \(\s*'user'::public\.profile_role,\s*'provider'::public\.profile_role\s*\) then\s*raise exception 'insufficient_role'/i,
    );
  });
}

test("the authorization repair explicitly revokes anonymous RPC access", () => {
  const repair = migrations.find(
    ({ name }) => name === "20261028120000_fail_closed_rpc_role_checks.sql",
  );
  assert.ok(repair);
  for (const name of [...adminFunctions, "upsert_provider_rating", "remove_provider_rating"]) {
    assert.match(
      repair.sql,
      new RegExp(`revoke all\\s+on function public\\.${name}\\([\\s\\S]*?\\)\\s+from public, anon;`, "i"),
    );
    assert.match(
      repair.sql,
      new RegExp(`grant execute\\s+on function public\\.${name}\\([\\s\\S]*?\\)\\s+to authenticated;`, "i"),
    );
  }
});

test("signup metadata cannot create an administrator", () => {
  const definition = functions.get("get_new_profile_role");
  assert.ok(definition);
  assert.match(definition, /then 'provider'::public\.profile_role/);
  assert.match(definition, /else 'user'::public\.profile_role/);
  assert.doesNotMatch(definition, /'admin'/);
});

test("account settings update grants exclude role and account identity", () => {
  const sql = readFileSync(
    new URL("20260629113000_add_shared_account_settings.sql", migrationDirectory),
    "utf8",
  );
  assert.match(sql, /revoke update on table public\.profiles from authenticated/);
  const columns = sql.match(/grant update \(([\s\S]*?)\)\s*on table public\.profiles/);
  assert.ok(columns);
  assert.doesNotMatch(columns[1], /\b(role|id|created_at)\b/i);
});

test("message previews run with the caller's RLS permissions", () => {
  const sql = readFileSync(
    new URL("20260723110000_add_contact_request_conversations.sql", migrationDirectory),
    "utf8",
  );
  assert.match(
    sql,
    /create or replace view public\.contact_request_latest_messages\s+with \(security_invoker = true\)/i,
  );
  const senderPolicy = readFileSync(
    new URL("20260723113000_fix_contact_message_sender_rls.sql", migrationDirectory),
    "utf8",
  );
  assert.match(senderPolicy, /contact_requests\.sender_user_id = \(select auth\.uid\(\)\)/);
  assert.match(senderPolicy, /provider_profiles\.user_id = \(select auth\.uid\(\)\)/);
});

test("public reviews contain display names and exclude private email addresses", () => {
  const definition = functions.get("get_provider_visible_reviews");
  assert.ok(definition);
  assert.match(definition, /provider_profiles\.status = 'active'/);
  assert.doesNotMatch(definition, /profiles\.email|reviewer_email/);
  const returnedColumns = definition.match(/returns table \(([\s\S]*?)\)/i);
  assert.ok(returnedColumns);
  assert.doesNotMatch(returnedColumns[1], /rater_user_id|email/);
  assert.match(definition, /least\(coalesce\(result_limit, 10\), 50\)/);
});

test("feedback screenshots are private, bounded images in account-owned folders", () => {
  const sql = readFileSync(
    new URL("20260724100000_add_platform_feedback.sql", migrationDirectory),
    "utf8",
  );
  assert.match(sql, /'feedback-screenshots',\s*'feedback-screenshots',\s*false,\s*5242880/);
  assert.match(sql, /array\['image\/jpeg', 'image\/png', 'image\/webp'\]/);
  assert.match(sql, /\(storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/);
});

test("privileged database and email delivery modules are server-only", () => {
  for (const path of ["lib/supabase/admin.ts", "lib/email/delivery.ts", "lib/email/provider-inquiries.ts"]) {
    assert.match(
      readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
      /^import "server-only";/,
      `${path} must not enter the client bundle`,
    );
  }
});
