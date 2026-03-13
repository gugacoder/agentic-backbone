import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createIssueNotesResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabIssueDeleteCommentTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_issue_delete_comment: tool({
      description: "Exclui um comentário de uma issue no GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        issue_iid: z.coerce.number().int().positive().describe("IID da issue no projeto"),
        note_id: z.coerce.number().int().positive().describe("ID do comentário (note)"),
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
          await createIssueNotesResource(client).delete(project, args.issue_iid, args.note_id);
          return { deleted: true };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
