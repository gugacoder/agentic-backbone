import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createCiPipelinesResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabCiListPipelinesTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_ci_list_pipelines: tool({
      description: "Lista pipelines CI/CD de um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        ref: z.string().optional().describe("Filtrar por branch/tag"),
        status: z.enum(["created","waiting_for_resource","preparing","pending","running","success","failed","canceled","skipped","manual","scheduled"]).optional().describe("Filtrar por status do pipeline"),
        per_page: z.number().optional().default(20).describe("Número de resultados"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.adapter ?? defaultSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const pipelines = await createCiPipelinesResource(client).list(project, {
            ref: args.ref,
            status: args.status,
            per_page: args.per_page,
          });
          return { pipelines };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
