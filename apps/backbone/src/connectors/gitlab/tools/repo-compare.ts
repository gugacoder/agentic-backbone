import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createRepoCompareResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabRepoCompareTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_repo_compare: tool({
      description: "Compara dois refs (branches, tags ou commits) em um repositório GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        from: z.string().describe("Ref de origem para comparação"),
        to: z.string().describe("Ref de destino para comparação"),
        straight: z.boolean().optional().describe("Usar diff direto (sem merge base)"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.adapter ?? defaultSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const result = await createRepoCompareResource(client).compare(project, args.from, args.to, args.straight);
          return { result };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
