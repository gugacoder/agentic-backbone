import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitHubSearchTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    github_search: tool({
      description: "Busca issues, código ou repositórios no GitHub usando a API de busca.",
      parameters: z.object({
        query: z.string().describe("Query de busca do GitHub (ex: 'bug repo:owner/repo label:bug')"),
        type: z.enum(["issues", "code", "repositories", "commits"]).optional().default("issues").describe("Tipo de busca"),
        per_page: z.number().optional().default(10).describe("Número de resultados"),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitHub a usar"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const params = new URLSearchParams({
            q: args.query,
            per_page: String(args.per_page ?? 10),
          });
          const result = await client.request(`/search/${args.type ?? "issues"}?${params}`);
          return { total_count: result.total_count, items: result.items };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
