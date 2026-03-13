import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createMilestonesResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabMilestoneUpdateTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_milestone_update: tool({
      description: "Atualiza um milestone existente em um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        milestone_id: z.coerce.number().int().positive().describe("ID do milestone"),
        title: z.string().optional().describe("Novo título do milestone"),
        description: z.string().optional().describe("Nova descrição do milestone"),
        due_date: z.string().optional().describe("Nova data de vencimento (YYYY-MM-DD)"),
        start_date: z.string().optional().describe("Nova data de início (YYYY-MM-DD)"),
        state_event: z.enum(["activate", "close"]).optional().describe("Ação de estado: activate ou close"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const adapter = adapters.find((a) => a.slug === adapterSlug);
          if (adapter?.policy === "readonly") return { error: "Adapter é readonly" };
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const milestone = await createMilestonesResource(client).update(project, args.milestone_id, {
            title: args.title,
            description: args.description,
            due_date: args.due_date,
            start_date: args.start_date,
            state_event: args.state_event,
          });
          return { milestone };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
