import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { loadAdapter } from "../loader.js";
import { guardMutate } from "../guards.js";
import { normalizeSlug } from "../_utils.js";

export const connector = "mysql";

export function create(adapters: { slug: string; policy: string }[]): ToolDefinition {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const policyMap = new Map(adapters.map((a) => [a.slug, a.policy]));
  return {
    name: "mysql_mutate",
    description: "Execute a DML mutation (INSERT, UPDATE, DELETE) on a MySQL database. Returns affected rows info.",
    parameters: z.object({
      database: z.preprocess(normalizeSlug, z.enum(slugs)).describe(`Database adapter slug. Valid values: ${slugs.join(", ")}`),
      sql: z.string().describe("SQL DML statement"),
    }),
    execute: async (args) => {
      const policy = policyMap.get(args.database) ?? "readonly";
      const rejection = guardMutate(args.sql, policy);
      if (rejection) return { error: rejection };
      try {
        const instance = await loadAdapter(args.database);
        return await instance.mutate(args.sql);
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
