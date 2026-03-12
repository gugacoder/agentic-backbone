import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitLabMrCreateTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_mr_create: tool({
      description: "Cria um novo merge request em um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        source_branch: z.string().describe("Branch de origem"),
        target_branch: z.string().describe("Branch de destino"),
        title: z.string().describe("Título do merge request"),
        description: z.string().optional().describe("Descrição do merge request (suporta Markdown)"),
        remove_source_branch: z.boolean().optional().describe("Remover source branch após merge"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const id = await client.resolveProjectId(project);
          const body: Record<string, unknown> = {
            source_branch: args.source_branch,
            target_branch: args.target_branch,
            title: args.title,
          };
          if (args.description !== undefined) body.description = args.description;
          if (args.remove_source_branch !== undefined) body.remove_source_branch = args.remove_source_branch;
          const merge_request = await client.request(`/projects/${id}/merge_requests`, {
            method: "POST",
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
