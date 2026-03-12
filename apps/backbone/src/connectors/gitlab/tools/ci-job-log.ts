import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitLabCiJobLogTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_ci_job_log: tool({
      description: "Obtém o log (trace) de um job CI/CD no GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        job_id: z.number().describe("ID do job"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const id = await client.resolveProjectId(project);
          const log = await client.request<string>(`/projects/${id}/jobs/${args.job_id}/trace`);
          const logStr = typeof log === "string" ? log : JSON.stringify(log);
          const truncated = logStr.length > 10000;
          return { job_id: args.job_id, truncated, log: logStr.slice(0, 10000) };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
