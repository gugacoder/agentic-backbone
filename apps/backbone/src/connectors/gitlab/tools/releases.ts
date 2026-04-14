import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createReleasesResource } from "../client.js";

const commonParams = z.object({
  project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
});

const listParams = z.object({ action: z.literal("list") }).merge(commonParams);

const getParams = z.object({ action: z.literal("get") }).merge(commonParams).extend({
  tag_name: z.string().describe("Nome da tag da release"),
});

const createParams = z.object({ action: z.literal("create") }).merge(commonParams).extend({
  tag_name: z.string().describe("Nome da tag da release"),
  name: z.string().describe("Nome da release"),
  description: z.string().describe("Descrição da release (suporta Markdown)"),
  ref: z.string().optional().describe("Branch ou SHA de referência para criar a tag (se não existir)"),
});

const updateParams = z.object({ action: z.literal("update") }).merge(commonParams).extend({
  tag_name: z.string().describe("Nome da tag da release"),
  name: z.string().optional().describe("Novo nome da release"),
  description: z.string().optional().describe("Nova descrição da release (suporta Markdown)"),
});

const deleteParams = z.object({ action: z.literal("delete") }).merge(commonParams).extend({
  tag_name: z.string().describe("Nome da tag da release a excluir"),
});

const paramsSchema = z.discriminatedUnion("action", [
  listParams,
  getParams,
  createParams,
  updateParams,
  deleteParams,
]);

const WRITE_ACTIONS = new Set(["create", "update", "delete"]);

export function createGitLabReleasesTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_releases: tool({
      description: [
        "Gerencia releases de projetos GitLab.",
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

          const releases = createReleasesResource(client);

          switch (args.action) {
            case "list":
              return { releases: await releases.list(project) };

            case "get":
              return { release: await releases.get(project, args.tag_name) };

            case "create":
              return { release: await releases.create(project, {
                tag_name: args.tag_name,
                name: args.name,
                description: args.description,
                ref: args.ref,
              }) };

            case "update":
              return { release: await releases.update(project, args.tag_name, {
                name: args.name,
                description: args.description,
              }) };

            case "delete":
              await releases.delete(project, args.tag_name);
              return { deleted: true };
          }
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
