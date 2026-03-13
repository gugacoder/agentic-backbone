import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createRepoTagsResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabRepoGetTagTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_repo_get_tag: tool({
      description: "Obtém detalhes de uma tag específica de um repositório GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        tag_name: z.string().describe("Nome da tag"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.adapter ?? defaultSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const tag = await createRepoTagsResource(client).get(project, args.tag_name);
          return { tag };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
