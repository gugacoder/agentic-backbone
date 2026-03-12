import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitLabRepoCreateBranchTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_repo_create_branch: tool({
      description: "Cria uma nova branch em um repositório GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        branch: z.string().describe("Nome da nova branch"),
        ref: z.string().describe("Branch, tag ou commit SHA de origem"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const id = await client.resolveProjectId(project);
          const result = await client.request(`/projects/${id}/repository/branches`, {
            method: "POST",
            body: JSON.stringify({ branch: args.branch, ref: args.ref }),
          });
          return { name: result.name, commit: result.commit?.id };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
