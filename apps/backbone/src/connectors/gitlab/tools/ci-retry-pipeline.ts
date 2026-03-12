import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitLabCiRetryPipelineTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_ci_retry_pipeline: tool({
      description: "Retenta (retry) um pipeline CI/CD no GitLab.",
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
          const result = await client.request(`/projects/${id}/pipelines/${args.pipeline_id}/retry`, {
            method: "POST",
          });
          return { pipeline: { id: result.id, status: result.status, ref: result.ref } };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
