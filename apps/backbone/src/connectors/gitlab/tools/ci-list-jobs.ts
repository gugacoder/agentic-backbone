import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createCiJobsResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabCiListJobsTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_ci_list_jobs: tool({
      description: "Lista jobs de um pipeline CI/CD no GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        pipeline_id: z.coerce.number().int().positive().describe("ID do pipeline"),
        per_page: z.number().optional().default(20).describe("Número de resultados"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.adapter ?? defaultSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const jobs = await createCiJobsResource(client).list(project, args.pipeline_id, { per_page: args.per_page });
          return { jobs };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
