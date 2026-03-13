import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createMrsResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabMrApprovalsTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_mr_approvals: tool({
      description: "Obtém informações de aprovações de um merge request no GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        mr_iid: z.coerce.number().int().positive().describe("IID do merge request no projeto"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.adapter ?? defaultSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const approvals = await createMrsResource(client).approvals(project, args.mr_iid);
          return { approvals };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
