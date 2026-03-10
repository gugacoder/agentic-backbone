import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { loadAdapter } from "../loader.js";
import { guardQuery } from "../guards.js";
import { normalizeSlug } from "../_utils.js";

export const connector = "postgres";

export function create(adapters: { slug: string; policy: string }[]): ToolDefinition {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  return {
    name: "postgres_query",
    description: "Execute a read-only SQL query on a PostgreSQL database. Returns rows as JSON.",
    parameters: z.object({
      database: z.preprocess(normalizeSlug, z.enum(slugs)).describe(`Database adapter slug. Valid values: ${slugs.join(", ")}`),
      sql: z.string().describe("SQL SELECT query"),
    }),
    execute: async (args) => {
      const rejection = guardQuery(args.sql);
      if (rejection) return { error: rejection };
      try {
        const instance = await loadAdapter(args.database);
        return await instance.query(args.sql);
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
