import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitLabRepoListBranchesTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_repo_list_branches: tool({
      description: "Lista branches de um repositório GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        search: z.string().optional().describe("Filtro por nome da branch"),
        per_page: z.number().optional().default(20).describe("Número de resultados"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const id = await client.resolveProjectId(project);
          const params = new URLSearchParams({ per_page: String(args.per_page ?? 20) });
          if (args.search) params.set("search", args.search);
          const data = await client.request<any[]>(`/projects/${id}/repository/branches?${params}`);
          return {
            branches: data.map((b) => ({
              name: b.name,
              default: b.default,
              merged: b.merged,
              protected: b.protected,
              commit: b.commit?.id,
            })),
          };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
