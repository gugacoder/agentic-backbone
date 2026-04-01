import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { settingsPath } from "../context/paths.js";
import { readYaml, writeYaml } from "../context/readers.js";

export interface NgrokConfig {
  authtoken?: string;
  domain?: string;
  enabled?: boolean;
}

export interface NgrokStatus {
  running: boolean;
  url?: string;
  error?: string;
}

let ngrokProcess: ChildProcess | null = null;

export function loadNgrokConfig(): NgrokConfig {
  if (!existsSync(settingsPath())) return {};
  const settings = readYaml(settingsPath()) as Record<string, unknown>;
  const infra = settings["infrastructure"] as Record<string, unknown> | undefined;
  if (!infra) return {};
  const ngrok = infra["ngrok"] as Record<string, unknown> | undefined;
  if (!ngrok) return {};
  return {
    authtoken: ngrok.authtoken as string | undefined,
    domain: ngrok.domain as string | undefined,
    enabled: ngrok.enabled as boolean | undefined,
  };
}

export function saveNgrokConfig(config: NgrokConfig): void {
  const settings = existsSync(settingsPath())
    ? (readYaml(settingsPath()) as Record<string, unknown>)
    : {};
  const infra = (settings["infrastructure"] as Record<string, unknown>) ?? {};
  infra["ngrok"] = config;
  settings["infrastructure"] = infra;
  writeYaml(settingsPath(), settings);
}

async function pollNgrokUrl(timeoutMs = 10000): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const resp = await fetch("http://localhost:4040/api/tunnels", {
        signal: AbortSignal.timeout(1000),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { tunnels: Array<{ public_url: string; proto: string }> };
        const tunnel = data.tunnels.find((t) => t.proto === "https") ?? data.tunnels[0];
        if (tunnel?.public_url) return tunnel.public_url;
      }
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

export async function startNgrok(port: number): Promise<NgrokStatus> {
  const config = loadNgrokConfig();

  if (ngrokProcess && !ngrokProcess.killed) {
    // Already running, just get status
    return getNgrokStatus();
  }

  const args = ["http", String(port)];
  if (config.authtoken) args.push("--authtoken", config.authtoken);
  if (config.domain) args.push("--domain", config.domain);

  try {
    ngrokProcess = spawn("ngrok", args, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    ngrokProcess.on("error", (err) => {
      console.error("[ngrok] process error:", err.message);
      ngrokProcess = null;
    });

    ngrokProcess.on("exit", (code) => {
      console.log(`[ngrok] process exited with code ${code}`);
      ngrokProcess = null;
    });

    const url = await pollNgrokUrl(10000);
    if (url) {
      return { running: true, url };
    } else {
      return { running: false, error: "Timeout: ngrok URL not available after 10s" };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { running: false, error: msg };
  }
}

export async function stopNgrok(): Promise<void> {
  if (ngrokProcess) {
    try {
      process.kill(ngrokProcess.pid!, "SIGTERM");
    } catch {
      // ignore
    }
    ngrokProcess = null;
  }
}

export async function getNgrokStatus(): Promise<NgrokStatus> {
  try {
    const resp = await fetch("http://localhost:4040/api/tunnels", {
      signal: AbortSignal.timeout(2000),
    });
    if (!resp.ok) return { running: false };
    const data = (await resp.json()) as { tunnels: Array<{ public_url: string; proto: string }> };
    const tunnel = data.tunnels.find((t) => t.proto === "https") ?? data.tunnels[0];
    if (tunnel?.public_url) return { running: true, url: tunnel.public_url };
    return { running: true };
  } catch {
    return { running: false };
  }
}
