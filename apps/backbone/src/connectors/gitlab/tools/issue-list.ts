import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

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
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const id = await client.resolveProjectId(project);
          const params = new URLSearchParams({
            state: args.state ?? "opened",
            per_page: String(args.per_page ?? 20),
          });
          if (args.labels) params.set("labels", args.labels);
          if (args.assignee_username) params.set("assignee_username", args.assignee_username);
          if (args.milestone) params.set("milestone", args.milestone);
          const issues = await client.request(`/projects/${id}/issues?${params}`);
          return { issues };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
