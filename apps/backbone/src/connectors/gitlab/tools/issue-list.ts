import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createIssuesResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabIssueListTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_issue_list: tool({
      description: "Lista issues de um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        state: z.enum(["opened", "closed", "all"]).optional().default("opened").describe("Estado das issues"),
        labels: z.string().optional().describe("Labels separadas por vírgula"),
        assignee_username: z.string().optional().describe("Username do assignee para filtrar"),
        milestone: z.string().optional().describe("Título do milestone para filtrar"),
        per_page: z.number().optional().default(20).describe("Número de resultados (máximo 100)"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.adapter ?? defaultSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const issues = await createIssuesResource(client).list(project, {
            state: args.state,
            labels: args.labels,
            assignee_username: args.assignee_username,
            milestone: args.milestone,
            per_page: args.per_page,
          });
          // Retorna apenas campos relevantes; omite `id` global para evitar confusão com `iid`
          const simplified = issues.map(({ id: _id, ...rest }) => rest);
          return { issues: simplified };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
