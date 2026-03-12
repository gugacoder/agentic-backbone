import type { z } from "zod";
import type { AdapterInstance } from "../types.js";
import type { credentialSchema, optionsSchema } from "./schemas.js";

type Credential = z.infer<typeof credentialSchema>;
type Options = z.infer<typeof optionsSchema>;

export interface HttpClient extends AdapterInstance {
  request(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<unknown>;
  get(path: string, headers?: Record<string, string>): Promise<unknown>;
  post(path: string, body: unknown, headers?: Record<string, string>): Promise<unknown>;
  put(path: string, body: unknown, headers?: Record<string, string>): Promise<unknown>;
  patch(path: string, body: unknown, headers?: Record<string, string>): Promise<unknown>;
  delete(path: string, headers?: Record<string, string>): Promise<unknown>;
  ping(): Promise<{ ok: boolean; error?: string }>;
}

export function createHttpClient(credential: Credential, options: Options): HttpClient {
  const baseUrl = credential.baseUrl.replace(/\/$/, "");
  const timeout = options.timeoutMs;

  function buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json", ...extra };
    if (credential.apiKey) {
      const prefix = credential.apiKeyPrefix ? `${credential.apiKeyPrefix} ` : "";
      headers[credential.apiKeyHeader ?? "Authorization"] = `${prefix}${credential.apiKey}`;
    }
    return headers;
  }

  async function request(method: string, path: string, body?: unknown, extra?: Record<string, string>): Promise<unknown> {
    const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        method,
        headers: buildHeaders(extra),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await res.text();
      let data: unknown;
      try { data = JSON.parse(text); } catch { data = text; }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    request,
    get: (path, headers) => request("GET", path, undefined, headers),
    post: (path, body, headers) => request("POST", path, body, headers),
    put: (path, body, headers) => request("PUT", path, body, headers),
    patch: (path, body, headers) => request("PATCH", path, body, headers),
    delete: (path, headers) => request("DELETE", path, undefined, headers),
    async ping() {
      try {
        const res = await fetch(baseUrl, { method: "HEAD", signal: AbortSignal.timeout(timeout) });
        return { ok: res.ok || res.status < 500 };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
