import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createCiJobsResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabCiJobLogTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_ci_job_log: tool({
      description: "Obtém o log (trace) de um job CI/CD no GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        job_id: z.coerce.number().int().positive().describe("ID do job"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.adapter ?? defaultSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const logStr = await createCiJobsResource(client).log(project, args.job_id);
          const truncated = logStr.length > 10000;
          return { job_id: args.job_id, truncated, log: logStr.slice(0, 10000) };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
