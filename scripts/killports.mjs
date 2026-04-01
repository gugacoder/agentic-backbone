#!/usr/bin/env node

/**
 * Kills processes holding the app ports (BACKBONE_PORT, HUB_PORT).
 * Reads ports from .env at the monorepo root.
 */

import { readFileSync } from "fs";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");

const ports = [];
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const m = line.match(/^(BACKBONE_PORT|HUB_PORT)\s*=\s*(\d+)/);
  if (m) ports.push({ name: m[1], port: m[2] });
}

if (!ports.length) {
  console.log("No ports found in .env");
  process.exit(0);
}

const isWin = process.platform === "win32";
let killed = 0;

for (const { name, port } of ports) {
  try {
    let pids;
    if (isWin) {
      const out = execSync(`netstat -ano | findstr ":${port}" | findstr "LISTENING"`, { encoding: "utf-8" });
      pids = [...new Set(out.match(/\d+$/gm))].filter(Boolean);
    } else {
      const out = execSync(`lsof -ti :${port}`, { encoding: "utf-8" });
      pids = [...new Set(out.trim().split("\n"))].filter(Boolean);
    }

    for (const pid of pids) {
      try {
        const cmd = isWin ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`;
        execSync(cmd, { stdio: "ignore" });
        console.log(`[${name}] killed PID ${pid} on port ${port}`);
        killed++;
      } catch {
        console.log(`[${name}] failed to kill PID ${pid} on port ${port}`);
      }
    }
  } catch {
    console.log(`[${name}] port ${port} is free`);
  }
}

console.log(killed ? `\nDone — ${killed} process(es) killed.` : "\nAll ports are free.");
