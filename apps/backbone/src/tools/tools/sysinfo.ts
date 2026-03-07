import { tool } from "ai";
import { z } from "zod";
import os from "node:os";
import { execSync } from "node:child_process";

export function createSysinfoTool(): Record<string, any> {
  return {
    sysinfo: tool({
      description:
        "Get system information: OS, CPU, memory, uptime, disk usage, and top processes by CPU.",
      parameters: z.object({}),
      execute: async () => {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const cpus = os.cpus();

        const info: Record<string, unknown> = {
          platform: os.platform(),
          arch: os.arch(),
          hostname: os.hostname(),
          release: os.release(),
          uptime: `${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`,
          cpuModel: cpus[0]?.model ?? "unknown",
          cpuCores: cpus.length,
          memoryTotal: `${(totalMem / 1024 / 1024 / 1024).toFixed(1)} GB`,
          memoryFree: `${(freeMem / 1024 / 1024 / 1024).toFixed(1)} GB`,
          memoryUsed: `${((totalMem - freeMem) / 1024 / 1024 / 1024).toFixed(1)} GB`,
          loadAvg: os.loadavg(),
        };

        // Disk usage
        try {
          if (os.platform() === "win32") {
            const disk = execSync("wmic logicaldisk get size,freespace,caption", { timeout: 5000 }).toString();
            info.disk = disk.trim();
          } else {
            const disk = execSync("df -h / | tail -1", { timeout: 5000 }).toString();
            info.disk = disk.trim();
          }
        } catch {}

        // Top processes
        try {
          if (os.platform() === "win32") {
            const top = execSync(
              'powershell -Command "Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 Name,CPU,WorkingSet | Format-Table -AutoSize"',
              { timeout: 5000 }
            ).toString();
            info.topProcesses = top.trim();
          } else {
            const top = execSync("ps aux --sort=-%cpu | head -6", { timeout: 5000 }).toString();
            info.topProcesses = top.trim();
          }
        } catch {}

        return info;
      },
    }),
  };
}
