#!/usr/bin/env node

import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import readline from "node:readline/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import process from "node:process";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultProjectRef = "eywzwkfeghbhwtsnjuti";
const args = new Set(process.argv.slice(2));
const optionValues = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith("--") && arg.includes("="))
    .map((arg) => {
      const [name, ...valueParts] = arg.split("=");
      return [name, valueParts.join("=")];
    }),
);
const isInteractive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

function windowsShellArg(value) {
  if (!value) {
    return "\"\"";
  }

  if (!/[\s"&|<>^]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '\\"')}"`;
}

function run(command, commandArgs, { interactive = false, required = true } = {}) {
  const printable = [command, ...commandArgs].join(" ");
  console.log(`\n> ${printable}`);

  const stdio = [interactive ? "inherit" : "ignore", "inherit", "inherit"];
  const result =
    process.platform === "win32"
      ? spawnSync([command, ...commandArgs].map(windowsShellArg).join(" "), {
          cwd: projectRoot,
          shell: true,
          stdio,
        })
      : spawnSync(command, commandArgs, {
          cwd: projectRoot,
          stdio,
        });

  if (result.error) {
    if (required) {
      throw result.error;
    }

    console.log(`\n${printable} could not start: ${result.error.message}`);
    return false;
  }

  if (result.status !== 0) {
    if (required) {
      process.exit(result.status ?? 1);
    }

    console.log(`\n${printable} exited with status ${result.status ?? 1}.`);
    return false;
  }

  return true;
}

function isYes(value, defaultValue = false) {
  const answer = value.trim().toLowerCase();

  if (!answer) {
    return defaultValue;
  }

  return answer === "y" || answer === "yes";
}

function hasPlaceholderSupabaseEnv(envLocalPath) {
  if (!existsSync(envLocalPath)) {
    return true;
  }

  const envLocal = readFileSync(envLocalPath, "utf8");

  return /your-project-ref|your-supabase|placeholder/i.test(envLocal);
}

function hasFlag(name) {
  return args.has(name);
}

function getOptionValue(name) {
  return optionValues.get(name);
}

function isForcedYes(name) {
  return hasFlag(name);
}

async function askYesNo(
  rl,
  question,
  defaultValue,
  { nonInteractiveDefault = defaultValue } = {},
) {
  if (!isInteractive) {
    console.log(
      `${question} ${nonInteractiveDefault ? "yes" : "no"} (non-interactive default)`,
    );
    return nonInteractiveDefault;
  }

  const answer = await rl.question(question);
  return isYes(answer, defaultValue);
}

async function askText(rl, question, defaultValue) {
  if (!isInteractive) {
    console.log(`${question}${defaultValue} (non-interactive default)`);
    return defaultValue;
  }

  const answer = await rl.question(question);
  return answer.trim() || defaultValue;
}

function printHelp() {
  console.log(`
MyRealHub setup

Usage:
  npm run setup
  npm run setup -- --yes
  npm run setup -- --skip-supabase
  npm run setup -- --project-ref=${defaultProjectRef}

What it does:
  1. Creates .env.local from .env.example if it does not exist.
  2. Installs npm dependencies.
  3. Offers to log into Supabase, link the project, and check migrations.
  4. Offers to run lint and typecheck.

Options:
  --yes                 Use default answers for prompts.
  --skip-install        Do not run npm install.
  --skip-supabase       Do not run Supabase login/link/migration checks.
  --skip-validation     Do not run lint or typecheck.
  --apply-migrations    Apply remote migrations after the dry run.
  --project-ref=<ref>   Supabase project ref to link.
`);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

console.log("\nMyRealHub setup\n");

const envExamplePath = join(projectRoot, ".env.example");
const envLocalPath = join(projectRoot, ".env.local");

if (!existsSync(envLocalPath)) {
  copyFileSync(envExamplePath, envLocalPath);
  console.log("\nCreated .env.local from .env.example.");
} else {
  console.log("\n.env.local already exists. Leaving it unchanged.");
}

console.log(`
Before running the app, make sure .env.local has:
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY

You can find both values in Supabase Dashboard > Project Settings > API.
`);

if (hasPlaceholderSupabaseEnv(envLocalPath)) {
  console.log(`
.env.local still contains placeholder Supabase values. Auth will not work until
you replace them with the project's URL and anon key.
`);
}

if (!hasFlag("--skip-install")) {
  run("npm", ["install"]);
} else {
  console.log("\nSkipped npm install.");
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

try {
  const setupSupabase =
    !hasFlag("--skip-supabase") &&
    (isForcedYes("--yes") ||
      (await askYesNo(
        rl,
        "Log in, link Supabase, and check migrations now? [Y/n] ",
        true,
        { nonInteractiveDefault: false },
      )));

  if (setupSupabase) {
    run("npx", ["supabase", "login"], { interactive: true, required: false });

    const projectRef =
      getOptionValue("--project-ref") ??
      (await askText(rl, `Supabase project ref [${defaultProjectRef}]: `, defaultProjectRef));

    const linked = run("npx", ["supabase", "link", "--project-ref", projectRef], {
      required: false,
    });

    if (linked) {
      const dryRunSucceeded = run("npx", ["supabase", "db", "push", "--dry-run"], {
        required: false,
      });

      const applyMigrations =
        dryRunSucceeded &&
        (isForcedYes("--apply-migrations") ||
          (await askYesNo(
            rl,
            "Apply pending remote migrations and seed data? [y/N] ",
            false,
          )));

      if (applyMigrations) {
        run("npx", ["supabase", "db", "push", "--include-seed"], {
          required: false,
        });
      } else {
        console.log("\nSkipped applying migrations.");
      }
    } else {
      console.log(`
Supabase linking did not complete. This usually means the logged-in Supabase
account does not have access to project ${projectRef}, or you need to run
npx supabase login with the correct account.
`);
    }
  } else {
    console.log("\nSkipped Supabase login/link.");
  }

  const validate =
    !hasFlag("--skip-validation") &&
    (isForcedYes("--yes") ||
      (await askYesNo(rl, "Run lint and typecheck now? [Y/n] ", true)));

  if (validate) {
    run("npm", ["run", "lint"]);
    run("npm", ["run", "typecheck"]);
  } else {
    console.log("\nSkipped validation.");
  }
} finally {
  rl.close();
}

console.log(`
Setup finished.

Next:
  1. Fill in .env.local if needed.
  2. Run npm run dev.
  3. Open http://localhost:3000.
  4. Check http://localhost:3000/api/supabase/health.
`);
