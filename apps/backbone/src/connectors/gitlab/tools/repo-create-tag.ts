import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createRepoTagsResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabRepoCreateTagTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_repo_create_tag: tool({
      description: "Cria uma nova tag em um repositório GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        tag_name: z.string().describe("Nome da nova tag"),
        ref: z.string().describe("Branch, tag ou commit SHA de referência"),
        message: z.string().optional().describe("Mensagem da tag anotada (opcional)"),
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
          const tag = await createRepoTagsResource(client).create(project, {
            tag_name: args.tag_name,
            ref: args.ref,
            message: args.message,
          });
          return { tag };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
