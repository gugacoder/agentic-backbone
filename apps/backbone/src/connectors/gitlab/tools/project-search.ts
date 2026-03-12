import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitLabProjectSearchTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_project_search: tool({
      description: "Busca projetos no GitLab por nome ou namespace. Não requer project_id.",
      parameters: z.object({
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        search: z.string().describe("Termo de busca"),
        per_page: z.number().optional().default(20).describe("Número de resultados"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const params = new URLSearchParams({
            search: args.search,
            search_namespaces: "true",
            simple: "true",
            per_page: String(args.per_page ?? 20),
          });
          const results = await client.request<any[]>(`/projects?${params}`);
          return {
            projects: results.map((p: any) => ({
              id: p.id,
              name: p.name,
              path_with_namespace: p.path_with_namespace,
              description: p.description,
              web_url: p.web_url,
              default_branch: p.default_branch,
            })),
          };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
