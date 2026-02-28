import { join } from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type { Service } from "./types.js";

export interface ServiceExecResult {
  ok: boolean;
  data: unknown;
  error?: string;
  durationMs: number;
}

export async function executeServiceDirect(
  service: Service,
  payload: unknown
): Promise<ServiceExecResult> {
  const execPath = join(service.dir, "exec.mjs");

  if (!existsSync(execPath)) {
    return {
      ok: false,
      data: null,
      error: `exec.mjs not found in ${service.dir}`,
      durationMs: 0,
    };
  }

  const startMs = Date.now();
  try {
    const mod = await import(pathToFileURL(execPath).href);
    const result = await mod.execute(payload, { serviceDir: service.dir });
    return {
      ok: true,
      data: result,
      durationMs: Date.now() - startMs,
    };
  } catch (err) {
    return {
      ok: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startMs,
    };
  }
}
