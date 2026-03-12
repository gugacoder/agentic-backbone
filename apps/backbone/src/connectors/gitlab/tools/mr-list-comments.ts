import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitLabMrListCommentsTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_mr_list_comments: tool({
      description: "Lista comentários de um merge request de um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        mr_iid: z.number().describe("IID do merge request no projeto"),
        per_page: z.number().optional().default(20).describe("Número de resultados (máximo 100)"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const id = await client.resolveProjectId(project);
          const notes = await client.request(`/projects/${id}/merge_requests/${args.mr_iid}/notes?per_page=${args.per_page ?? 20}`);
          return { notes };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
