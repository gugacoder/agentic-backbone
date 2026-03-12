import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitLabMrMergeTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_mr_merge: tool({
      description: "Faz merge de um merge request em um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        mr_iid: z.number().describe("IID do merge request no projeto"),
        merge_commit_message: z.string().optional().describe("Mensagem do commit de merge"),
        squash: z.boolean().optional().default(false).describe("Squash commits ao fazer merge"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const id = await client.resolveProjectId(project);
          const body: Record<string, unknown> = {};
          if (args.merge_commit_message !== undefined) body.merge_commit_message = args.merge_commit_message;
          if (args.squash !== undefined) body.squash = args.squash;
          const merge_request = await client.request(`/projects/${id}/merge_requests/${args.mr_iid}/merge`, {
            method: "PUT",
            body: JSON.stringify(body),
          });
          return { merge_request };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
