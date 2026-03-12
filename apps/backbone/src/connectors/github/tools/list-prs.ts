import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitHubListPrsTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    github_list_prs: tool({
      description: "Lista pull requests de um repositório GitHub.",
      parameters: z.object({
        repo: z.string().optional().describe("Repositório no formato owner/repo (usa default do adapter se omitido)"),
        state: z.enum(["open", "closed", "all"]).optional().default("open").describe("Estado dos PRs"),
        per_page: z.number().optional().default(20).describe("Número de resultados"),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitHub a usar"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const repo = args.repo ?? client.defaultRepo;
          if (!repo) return { error: "Repositório não especificado e sem default configurado" };
          const params = new URLSearchParams({
            state: args.state ?? "open",
            per_page: String(args.per_page ?? 20),
          });
          const prs = await client.request(`/repos/${repo}/pulls?${params}`);
          return { pull_requests: prs };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
