import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitLabRepoListCommitsTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_repo_list_commits: tool({
      description: "Lista commits de um repositório GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        ref_name: z.string().optional().describe("Branch, tag ou commit SHA para filtrar"),
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
          if (args.ref_name) params.set("ref_name", args.ref_name);
          const data = await client.request<any[]>(`/projects/${id}/repository/commits?${params}`);
          return {
            commits: data.map((c) => ({
              id: c.id,
              short_id: c.short_id,
              title: c.title,
              author_name: c.author_name,
              authored_date: c.authored_date,
              message: c.message,
            })),
          };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
