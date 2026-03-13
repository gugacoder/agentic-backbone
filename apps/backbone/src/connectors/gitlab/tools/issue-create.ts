import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createIssuesResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabIssueCreateTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_issue_create: tool({
      description: "Cria uma nova issue em um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        title: z.string().describe("Título da issue"),
        description: z.string().optional().describe("Descrição da issue (suporta Markdown)"),
        labels: z.string().optional().describe("Labels separadas por vírgula"),
        assignee_ids: z.array(z.number()).optional().describe("IDs de usuários para atribuir"),
        milestone_id: z.number().optional().describe("ID do milestone"),
        due_date: z.string().optional().describe("Data de vencimento (YYYY-MM-DD)"),
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
          const issue = await createIssuesResource(client).create(project, {
            title: args.title,
            description: args.description,
            labels: args.labels,
            assignee_ids: args.assignee_ids,
            milestone_id: args.milestone_id,
            due_date: args.due_date,
          });
          return { issue };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
