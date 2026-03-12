import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitLabMrCommentTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_mr_comment: tool({
      description: "Adiciona um comentário a um merge request de um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        mr_iid: z.number().describe("IID do merge request no projeto"),
        body: z.string().describe("Texto do comentário"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const id = await client.resolveProjectId(project);
          const note = await client.request(`/projects/${id}/merge_requests/${args.mr_iid}/notes`, {
            method: "POST",
            body: JSON.stringify({ body: args.body }),
          });
          return { note };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
