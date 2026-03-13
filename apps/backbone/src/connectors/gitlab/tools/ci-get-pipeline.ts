import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createCiPipelinesResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabCiGetPipelineTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_ci_get_pipeline: tool({
      description: "Obtém detalhes de um pipeline CI/CD específico no GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        pipeline_id: z.coerce.number().int().positive().describe("ID do pipeline"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.adapter ?? defaultSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const pipeline = await createCiPipelinesResource(client).get(project, args.pipeline_id);
          return { pipeline };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
