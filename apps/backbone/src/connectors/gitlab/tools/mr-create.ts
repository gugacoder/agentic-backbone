import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createMrsResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabMrCreateTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_mr_create: tool({
      description: "Cria um novo merge request em um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        source_branch: z.string().describe("Branch de origem"),
        target_branch: z.string().describe("Branch de destino"),
        title: z.string().describe("Título do merge request"),
        description: z.string().optional().describe("Descrição do merge request (suporta Markdown)"),
        remove_source_branch: z.boolean().optional().describe("Remover source branch após merge"),
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
          const merge_request = await createMrsResource(client).create(project, {
            source_branch: args.source_branch,
            target_branch: args.target_branch,
            title: args.title,
            description: args.description,
            remove_source_branch: args.remove_source_branch,
          });
          return { merge_request };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
