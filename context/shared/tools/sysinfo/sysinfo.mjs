#!/usr/bin/env node
import os from "node:os";
import { execSync } from "node:child_process";

const isWin = process.platform === "win32";

// --- OS ---
function getOS() {
  const upSec = os.uptime();
  const h = Math.floor(upSec / 3600);
  const m = Math.floor((upSec % 3600) / 60);
  return [
    `Hostname : ${os.hostname()}`,
    `Platform : ${os.platform()} (${os.arch()})`,
    `Release  : ${os.release()}`,
    `Uptime   : ${h}h ${m}m`,
  ].join("\n");
}

// --- CPU ---
function getCPU() {
  const cpus = os.cpus();
  const model = cpus[0]?.model ?? "unknown";
  const cores = cpus.length;

  // Average load (1 min) — not available on Windows, fallback to per-core idle
  let load = "";
  if (!isWin) {
    const avg = os.loadavg();
    load = `Load avg : ${avg[0].toFixed(2)} / ${avg[1].toFixed(2)} / ${avg[2].toFixed(2)} (1/5/15 min)`;
  } else {
    // Compute instant idle% across cores
    const idle = cpus.reduce((sum, c) => {
      const total = Object.values(c.times).reduce((a, b) => a + b, 0);
      return sum + c.times.idle / total;
    }, 0) / cores;
    load = `Idle avg : ${(idle * 100).toFixed(1)}%`;
  }

  return [
    `Model    : ${model}`,
    `Cores    : ${cores}`,
    load,
  ].join("\n");
}

// --- Memory ---
function getMemory() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const pct = ((used / total) * 100).toFixed(1);
  const fmt = (b) => (b / 1024 / 1024 / 1024).toFixed(2) + " GB";
  return [
    `Total    : ${fmt(total)}`,
    `Used     : ${fmt(used)} (${pct}%)`,
    `Free     : ${fmt(free)}`,
  ].join("\n");
}

// --- Disk ---
function getDisk() {
  try {
    if (isWin) {
      // PowerShell: Get-Volume for mounted drives
      const raw = execSync(
        'powershell -NoProfile -Command "Get-Volume | Where-Object { $_.DriveLetter } | Select-Object DriveLetter, @{N=\'SizeGB\';E={[math]::Round($_.Size/1GB,2)}}, @{N=\'FreeGB\';E={[math]::Round($_.SizeRemaining/1GB,2)}} | Format-Table -AutoSize | Out-String"',
        { encoding: "utf-8", timeout: 10000 }
      );
      return raw.trim();
    } else {
      const raw = execSync("df -h --output=target,size,avail,pcent -x tmpfs -x devtmpfs 2>/dev/null || df -h", {
        encoding: "utf-8",
        timeout: 10000,
      });
      return raw.trim();
    }
  } catch {
    return "(erro ao coletar dados de disco)";
  }
}

// --- Network ---
function getNetwork() {
  const ifaces = os.networkInterfaces();
  const lines = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    for (const a of addrs) {
      if (a.internal) continue;
      lines.push(`${name.padEnd(16)} ${a.family.padEnd(6)} ${a.address}`);
    }
  }
  return lines.length > 0 ? lines.join("\n") : "(nenhuma interface externa)";
}

// --- Top Processes ---
function getTopProcesses() {
  try {
    if (isWin) {
      const raw = execSync(
        'powershell -NoProfile -Command "Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 Name, @{N=\'CPU_s\';E={[math]::Round($_.CPU,1)}}, @{N=\'Mem_MB\';E={[math]::Round($_.WorkingSet64/1MB,1)}} | Format-Table -AutoSize | Out-String"',
        { encoding: "utf-8", timeout: 10000 }
      );
      return raw.trim();
    } else {
      const raw = execSync("ps aux --sort=-%cpu | head -6", {
        encoding: "utf-8",
        timeout: 10000,
      });
      return raw.trim();
    }
  } catch {
    return "(erro ao coletar processos)";
  }
}

// --- Output ---
console.log("=== SYSINFO ===\n");
console.log("-- OS --");
console.log(getOS());
console.log("\n-- CPU --");
console.log(getCPU());
console.log("\n-- MEMÓRIA --");
console.log(getMemory());
console.log("\n-- DISCO --");
console.log(getDisk());
console.log("\n-- REDE --");
console.log(getNetwork());
console.log("\n-- TOP PROCESSOS (por CPU) --");
console.log(getTopProcesses());
console.log("\n=== FIM ===");
