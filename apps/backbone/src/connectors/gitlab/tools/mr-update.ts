import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitLabMrUpdateTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_mr_update: tool({
      description: "Atualiza um merge request existente em um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        mr_iid: z.number().describe("IID do merge request no projeto"),
        title: z.string().optional().describe("Novo título do merge request"),
        description: z.string().optional().describe("Nova descrição do merge request"),
        state_event: z.enum(["reopen", "close"]).optional().describe("Ação de estado: reopen ou close"),
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
          const merge_request = await client.request(`/projects/${id}/merge_requests/${args.mr_iid}`, {
            method: "PUT",
            body: JSON.stringify(body),
          });
          return { merge_request };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
