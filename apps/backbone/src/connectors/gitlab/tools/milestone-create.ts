import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createMilestonesResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabMilestoneCreateTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_milestone_create: tool({
      description: "Cria um novo milestone em um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        title: z.string().describe("Título do milestone"),
        description: z.string().optional().describe("Descrição do milestone"),
        due_date: z.string().optional().describe("Data de vencimento (YYYY-MM-DD)"),
        start_date: z.string().optional().describe("Data de início (YYYY-MM-DD)"),
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
          const milestone = await createMilestonesResource(client).create(project, {
            title: args.title,
            description: args.description,
            due_date: args.due_date,
            start_date: args.start_date,
          });
          return { milestone };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
