import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createIssuesResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabIssueAddLinkTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_issue_add_link: tool({
      description: "Adiciona um link entre duas issues no GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        issue_iid: z.coerce.number().int().positive().describe("IID da issue de origem no projeto"),
        target_project_id: z.number().describe("ID do projeto da issue destino"),
        target_issue_iid: z.coerce.number().int().positive().describe("IID da issue destino"),
        link_type: z.enum(["relates_to", "blocks", "is_blocked_by"]).optional().describe("Tipo de link"),
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
          const link = await createIssuesResource(client).addLink(project, args.issue_iid, args.target_project_id, args.target_issue_iid, args.link_type);
          return { link };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
