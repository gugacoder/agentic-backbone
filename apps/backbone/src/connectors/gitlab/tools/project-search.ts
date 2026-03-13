import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createProjectsResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabProjectSearchTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_project_search: tool({
      description: "Busca projetos no GitLab por nome ou namespace. Não requer project_id.",
      parameters: z.object({
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        query: z.string().describe("Termo de busca"),
        per_page: z.number().optional().default(20).describe("Número de resultados"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.adapter ?? defaultSlug) as any;
          const projects = await createProjectsResource(client).search(args.query, { per_page: args.per_page });
          return { projects };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
