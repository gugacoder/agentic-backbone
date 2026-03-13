import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createMrNotesResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabMrUpdateCommentTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_mr_update_comment: tool({
      description: "Atualiza um comentário de um merge request no GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        mr_iid: z.coerce.number().int().positive().describe("IID do merge request no projeto"),
        note_id: z.coerce.number().int().positive().describe("ID do comentário (note)"),
        body: z.string().describe("Novo texto do comentário"),
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
          const note = await createMrNotesResource(client).update(project, args.mr_iid, args.note_id, args.body);
          return { note };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
