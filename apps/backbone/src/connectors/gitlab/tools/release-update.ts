import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createReleasesResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabReleaseUpdateTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_release_update: tool({
      description: "Atualiza uma release existente em um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        tag_name: z.string().describe("Nome da tag da release"),
        name: z.string().optional().describe("Novo nome da release"),
        description: z.string().optional().describe("Nova descrição da release (suporta Markdown)"),
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
          const release = await createReleasesResource(client).update(project, args.tag_name, {
            name: args.name,
            description: args.description,
          });
          return { release };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
