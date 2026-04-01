import type { z } from "zod";
import type { credentialSchema, optionsSchema } from "./schemas.js";

type Credential = z.infer<typeof credentialSchema>;
type Options = z.infer<typeof optionsSchema>;

export function createEvolutionClient(credential: Credential, options: Options) {
  const baseUrl = credential.host;
  const apiKey = credential.api_key;
  const timeout = options.timeout ?? 5000;

  async function request(method: string, path: string, body?: unknown) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          apikey: apiKey,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async get(path: string) { return request("GET", path); },
    async send(path: string, body?: unknown) { return request("POST", path, body); },
    async delete(path: string) { return request("DELETE", path); },
    async close() { /* no persistent connections */ },
  };
}
