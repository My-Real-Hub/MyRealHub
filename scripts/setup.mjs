#!/usr/bin/env node

import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import readline from "node:readline/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import process from "node:process";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultProjectRef = "eywzwkfeghbhwtsnjuti";

function commandName(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function run(command, args) {
  const printable = [command, ...args].join(" ");
  console.log(`\n> ${printable}`);

  const result = spawnSync(commandName(command), args, {
    cwd: projectRoot,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function isYes(value, defaultValue = false) {
  const answer = value.trim().toLowerCase();

  if (!answer) {
    return defaultValue;
  }

  return answer === "y" || answer === "yes";
}

function printHelp() {
  console.log(`
MyRealHub setup

Usage:
  npm run setup

What it does:
  1. Installs npm dependencies.
  2. Creates .env.local from .env.example if it does not exist.
  3. Optionally logs into Supabase, links the project, and applies migrations.
  4. Optionally runs lint and typecheck.
`);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

console.log("\nMyRealHub setup\n");

run("npm", ["install"]);

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

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

try {
  const setupSupabase = await rl.question(
    "Log in, link Supabase, and check migrations now? [Y/n] ",
  );

  if (isYes(setupSupabase, true)) {
    run("npx", ["supabase", "login"]);

    const projectRefAnswer = await rl.question(
      `Supabase project ref [${defaultProjectRef}]: `,
    );
    const projectRef = projectRefAnswer.trim() || defaultProjectRef;

    run("npx", ["supabase", "link", "--project-ref", projectRef]);
    run("npx", ["supabase", "db", "push", "--dry-run"]);

    const applyMigrations = await rl.question(
      "Apply pending remote migrations and seed data? [y/N] ",
    );

    if (isYes(applyMigrations, false)) {
      run("npx", ["supabase", "db", "push", "--include-seed"]);
    } else {
      console.log("\nSkipped applying migrations.");
    }
  } else {
    console.log("\nSkipped Supabase login/link.");
  }

  const validate = await rl.question("Run lint and typecheck now? [Y/n] ");

  if (isYes(validate, true)) {
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
