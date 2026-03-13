import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createMilestonesResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabMilestoneListTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_milestone_list: tool({
      description: "Lista milestones de um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        state: z.enum(["active", "closed"]).optional().describe("Estado dos milestones"),
        per_page: z.number().optional().default(20).describe("Número de resultados"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.adapter ?? defaultSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const milestones = await createMilestonesResource(client).list(project, {
            state: args.state,
            per_page: args.per_page,
          });
          return { milestones };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
