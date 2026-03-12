import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitLabProjectListMembersTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_project_list_members: tool({
      description: "Lista membros de um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
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
          const data = await client.request<any[]>(`/projects/${id}/members?per_page=${args.per_page ?? 20}`);
          return {
            members: data.map((m) => ({
              id: m.id,
              username: m.username,
              name: m.name,
              access_level: m.access_level,
              state: m.state,
            })),
          };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
