import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitLabCiListJobsTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_ci_list_jobs: tool({
      description: "Lista jobs de um pipeline CI/CD no GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        pipeline_id: z.number().describe("ID do pipeline"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const id = await client.resolveProjectId(project);
          const data = await client.request<any[]>(`/projects/${id}/pipelines/${args.pipeline_id}/jobs`);
          return {
            jobs: data.map((j) => ({
              id: j.id,
              name: j.name,
              stage: j.stage,
              status: j.status,
              created_at: j.created_at,
              started_at: j.started_at,
              finished_at: j.finished_at,
              duration: j.duration,
              web_url: j.web_url,
            })),
          };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
