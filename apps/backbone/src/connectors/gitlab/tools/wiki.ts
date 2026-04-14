import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createWikiResource } from "../client.js";

const commonParams = z.object({
  project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
});

const listParams = z.object({ action: z.literal("list") }).merge(commonParams);

const getParams = z.object({ action: z.literal("get") }).merge(commonParams).extend({
  slug: z.string().describe("Slug da página da wiki"),
});

const createParams = z.object({ action: z.literal("create") }).merge(commonParams).extend({
  title: z.string().describe("Título da página"),
  content: z.string().describe("Conteúdo da página"),
  format: z.enum(["markdown", "rdoc", "asciidoc"]).optional().describe("Formato do conteúdo"),
});

const updateParams = z.object({ action: z.literal("update") }).merge(commonParams).extend({
  slug: z.string().describe("Slug da página da wiki"),
  title: z.string().optional().describe("Novo título da página"),
  content: z.string().optional().describe("Novo conteúdo da página"),
  format: z.enum(["markdown", "rdoc", "asciidoc"]).optional().describe("Formato do conteúdo"),
});

const deleteParams = z.object({ action: z.literal("delete") }).merge(commonParams).extend({
  slug: z.string().describe("Slug da página da wiki a excluir"),
});

const paramsSchema = z.discriminatedUnion("action", [
  listParams,
  getParams,
  createParams,
  updateParams,
  deleteParams,
]);

const WRITE_ACTIONS = new Set(["create", "update", "delete"]);

export function createGitLabWikiTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_wiki: tool({
      description: [
        "Gerencia a wiki de projetos GitLab.",
        "Ações: list, get, create, update, delete.",
      ].join(" "),
      parameters: paramsSchema.and(z.object({
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
      })),
      execute: async (args) => {
        try {
          const adapterSlug = args.adapter ?? defaultSlug;

          if (WRITE_ACTIONS.has(args.action)) {
            const adapter = adapters.find((a) => a.slug === adapterSlug);
            if (adapter?.policy === "readonly") return { error: "Adapter é readonly" };
          }

          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };

          const wiki = createWikiResource(client);

          switch (args.action) {
            case "list":
              return { pages: await wiki.list(project) };

            case "get":
              return { page: await wiki.get(project, args.slug) };

            case "create":
              return { page: await wiki.create(project, {
                title: args.title,
                content: args.content,
                format: args.format,
              }) };

            case "update":
              return { page: await wiki.update(project, args.slug, {
                title: args.title,
                content: args.content,
                format: args.format,
              }) };

            case "delete":
              await wiki.delete(project, args.slug);
              return { deleted: true };
          }
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
