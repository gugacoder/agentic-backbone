import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

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
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const id = await client.resolveProjectId(project);
          const body: Record<string, unknown> = { title: args.title };
          if (args.description !== undefined) body.description = args.description;
          if (args.labels !== undefined) body.labels = args.labels;
          if (args.assignee_ids !== undefined) body.assignee_ids = args.assignee_ids;
          if (args.milestone_id !== undefined) body.milestone_id = args.milestone_id;
          const issue = await client.request(`/projects/${id}/issues`, {
            method: "POST",
            body: JSON.stringify(body),
          });
          return { issue };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
