import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createMilestonesResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabMilestoneGetTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_milestone_get: tool({
      description: "Obtém detalhes de um milestone específico de um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        milestone_id: z.coerce.number().int().positive().describe("ID do milestone"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.adapter ?? defaultSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const milestone = await createMilestonesResource(client).get(project, args.milestone_id);
          return { milestone };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
