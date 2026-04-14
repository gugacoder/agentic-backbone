import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createLabelsResource } from "../client.js";

const commonParams = z.object({
  project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
});

const listParams = z.object({ action: z.literal("list") }).merge(commonParams).extend({
  per_page: z.number().optional().default(20).describe("Número de resultados"),
});

const getParams = z.object({ action: z.literal("get") }).merge(commonParams).extend({
  label_id: z.coerce.number().int().positive().describe("ID da label"),
});

const createParams = z.object({ action: z.literal("create") }).merge(commonParams).extend({
  name: z.string().describe("Nome da label"),
  color: z.string().describe("Cor da label em formato hex (ex: #FF0000)"),
  description: z.string().optional().describe("Descrição da label"),
  priority: z.number().optional().describe("Prioridade da label"),
});

const updateParams = z.object({ action: z.literal("update") }).merge(commonParams).extend({
  label_id: z.coerce.number().int().positive().describe("ID da label"),
  name: z.string().optional().describe("Novo nome da label"),
  color: z.string().optional().describe("Nova cor da label em formato hex"),
  description: z.string().optional().describe("Nova descrição da label"),
  priority: z.number().optional().describe("Nova prioridade da label"),
});

const deleteParams = z.object({ action: z.literal("delete") }).merge(commonParams).extend({
  label_id: z.coerce.number().int().positive().describe("ID da label"),
});

const paramsSchema = z.discriminatedUnion("action", [
  listParams,
  getParams,
  createParams,
  updateParams,
  deleteParams,
]);

const WRITE_ACTIONS = new Set(["create", "update", "delete"]);

export function createGitLabLabelsTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_labels: tool({
      description: [
        "Gerencia labels de projetos GitLab.",
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

          const labels = createLabelsResource(client);

          switch (args.action) {
            case "list":
              return { labels: await labels.list(project, { per_page: args.per_page }) };

            case "get":
              return { label: await labels.get(project, args.label_id) };

            case "create":
              return { label: await labels.create(project, {
                name: args.name,
                color: args.color,
                description: args.description,
                priority: args.priority,
              }) };

            case "update":
              return { label: await labels.update(project, args.label_id, {
                name: args.name,
                color: args.color,
                description: args.description,
                priority: args.priority,
              }) };

            case "delete":
              await labels.delete(project, args.label_id);
              return { deleted: true };
          }
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
