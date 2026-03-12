import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitLabIssueUpdateTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_issue_update: tool({
      description: "Atualiza uma issue existente em um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        issue_iid: z.number().describe("IID da issue no projeto"),
        title: z.string().optional().describe("Novo título da issue"),
        description: z.string().optional().describe("Nova descrição da issue"),
        state_event: z.enum(["reopen", "close"]).optional().describe("Ação de estado: reopen ou close"),
        labels: z.string().optional().describe("Labels separadas por vírgula"),
        assignee_ids: z.array(z.number()).optional().describe("IDs de usuários para atribuir"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const id = await client.resolveProjectId(project);
          const body: Record<string, unknown> = {};
          if (args.title !== undefined) body.title = args.title;
          if (args.description !== undefined) body.description = args.description;
          if (args.state_event !== undefined) body.state_event = args.state_event;
          if (args.labels !== undefined) body.labels = args.labels;
          if (args.assignee_ids !== undefined) body.assignee_ids = args.assignee_ids;
          const issue = await client.request(`/projects/${id}/issues/${args.issue_iid}`, {
            method: "PUT",
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
