#!/usr/bin/env node
/**
 * Run All Capability Tests
 *
 * Executes every capability test suite sequentially and prints a summary.
 * Exit codes: 0 = all passed, 1 = some failed, 2 = fatal/config error.
 *
 * Usage:
 *   npm run test:capabilities
 */

import { execFileSync } from "node:child_process";
import { resolve, basename } from "node:path";

const SUITES = [
  "test-conversation-identity-and-context.mjs",
  "test-conversation-skills.mjs",
  "test-conversation-tools.mjs",
  "test-conversation-memory.mjs",
  "test-conversation-jobs.mjs",
  "test-conversation-cron.mjs",
  "test-conversation-hooks.mjs",
];

const DIR = new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");

const results = [];
let anyFailed = false;

console.log("╔══════════════════════════════════════════════════════╗");
console.log("║           Capability Tests — Run All                ║");
console.log("╚══════════════════════════════════════════════════════╝\n");

for (const suite of SUITES) {
  const label = basename(suite, ".mjs").replace("test-conversation-", "");
  const filePath = resolve(DIR, suite);

  process.stdout.write(`▶ ${label} ... `);

  const start = Date.now();
  let exitCode = 0;

  try {
    execFileSync(process.execPath, ["--env-file=.env", filePath], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
      cwd: process.cwd(),
      timeout: 5 * 60 * 1000,
    });
  } catch (err) {
    exitCode = err.status ?? 2;
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const icon = exitCode === 0 ? "PASS" : "FAIL";

  if (exitCode !== 0) anyFailed = true;

  results.push({ label, exitCode, elapsed });
  console.log(`${icon}  (${elapsed}s)`);
}

// ── Summary ──────────────────────────────────────────────

console.log("\n────────────────────────────────────────────────────────");
console.log("  Suite Summary");
console.log("────────────────────────────────────────────────────────");

const passed = results.filter((r) => r.exitCode === 0).length;
const failed = results.filter((r) => r.exitCode !== 0).length;

for (const r of results) {
  const icon = r.exitCode === 0 ? "  PASS" : "  FAIL";
  console.log(`${icon}  ${r.label}  (${r.elapsed}s)`);
}

console.log("────────────────────────────────────────────────────────");
console.log(`  ${passed} passed, ${failed} failed, ${results.length} total`);
console.log("────────────────────────────────────────────────────────\n");

process.exit(anyFailed ? 1 : 0);
