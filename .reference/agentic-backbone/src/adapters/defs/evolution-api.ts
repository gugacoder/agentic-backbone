import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { loadAdapter } from "../loader.js";
import { normalizeSlug } from "../_utils.js";

export const connector = "evolution";

export function create(adapters: { slug: string; policy: string }[]): ToolDefinition {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  return {
    name: "evolution_api",
    description: "Call the Evolution API (WhatsApp gateway). Supports GET and POST methods.",
    parameters: z.object({
      instance: z.preprocess(normalizeSlug, z.enum(slugs)).describe(`Evolution adapter slug. Valid values: ${slugs.join(", ")}`),
      method: z.enum(["GET", "POST"]).describe("HTTP method"),
      endpoint: z.string().describe("API endpoint path (e.g. /message/sendText/instance)"),
      body: z.string().optional().describe("JSON body for POST requests"),
    }),
    execute: async (args) => {
      try {
        const adapter = await loadAdapter(args.instance);
        if (args.method === "GET") return await adapter.get(args.endpoint);
        const body = args.body ? JSON.parse(args.body) : undefined;
        return await adapter.send(args.endpoint, body);
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
