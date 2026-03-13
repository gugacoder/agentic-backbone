import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createWikiResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabWikiUpdateTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_wiki_update: tool({
      description: "Atualiza uma página existente na wiki de um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        slug: z.string().describe("Slug da página da wiki"),
        title: z.string().optional().describe("Novo título da página"),
        content: z.string().optional().describe("Novo conteúdo da página"),
        format: z.enum(["markdown", "rdoc", "asciidoc"]).optional().describe("Formato do conteúdo"),
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
          const page = await createWikiResource(client).update(project, args.slug, {
            title: args.title,
            content: args.content,
            format: args.format,
          });
          return { page };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
