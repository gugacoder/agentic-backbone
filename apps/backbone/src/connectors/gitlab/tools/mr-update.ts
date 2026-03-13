import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createMrsResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabMrUpdateTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_mr_update: tool({
      description: "Atualiza um merge request existente em um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        mr_iid: z.coerce.number().int().positive().describe("IID do merge request no projeto"),
        title: z.string().optional().describe("Novo título do merge request"),
        description: z.string().optional().describe("Nova descrição do merge request"),
        labels: z.string().optional().describe("Labels separadas por vírgula"),
        assignee_ids: z.array(z.number()).optional().describe("IDs de usuários para atribuir"),
        state_event: z.enum(["reopen", "close"]).optional().describe("Ação de estado: reopen ou close"),
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
          const merge_request = await createMrsResource(client).update(project, args.mr_iid, {
            title: args.title,
            description: args.description,
            labels: args.labels,
            assignee_ids: args.assignee_ids,
            state_event: args.state_event,
          });
          return { merge_request };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
