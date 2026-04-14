import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createMilestonesResource } from "../client.js";

const commonParams = z.object({
  project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
});

const listParams = z.object({ action: z.literal("list") }).merge(commonParams).extend({
  state: z.enum(["active", "closed"]).optional().describe("Estado dos milestones"),
  per_page: z.number().optional().default(20).describe("Número de resultados"),
});

const getParams = z.object({ action: z.literal("get") }).merge(commonParams).extend({
  milestone_id: z.coerce.number().int().positive().describe("ID do milestone"),
});

const createParams = z.object({ action: z.literal("create") }).merge(commonParams).extend({
  title: z.string().describe("Título do milestone"),
  description: z.string().optional().describe("Descrição do milestone"),
  due_date: z.string().optional().describe("Data de vencimento (YYYY-MM-DD)"),
  start_date: z.string().optional().describe("Data de início (YYYY-MM-DD)"),
});

const updateParams = z.object({ action: z.literal("update") }).merge(commonParams).extend({
  milestone_id: z.coerce.number().int().positive().describe("ID do milestone"),
  title: z.string().optional().describe("Novo título do milestone"),
  description: z.string().optional().describe("Nova descrição do milestone"),
  due_date: z.string().optional().describe("Nova data de vencimento (YYYY-MM-DD)"),
  start_date: z.string().optional().describe("Nova data de início (YYYY-MM-DD)"),
  state_event: z.enum(["activate", "close"]).optional().describe("Ação de estado: activate ou close"),
});

const deleteParams = z.object({ action: z.literal("delete") }).merge(commonParams).extend({
  milestone_id: z.coerce.number().int().positive().describe("ID do milestone"),
});

const issuesParams = z.object({ action: z.literal("issues") }).merge(commonParams).extend({
  milestone_id: z.coerce.number().int().positive().describe("ID do milestone"),
});

const mrsParams = z.object({ action: z.literal("mrs") }).merge(commonParams).extend({
  milestone_id: z.coerce.number().int().positive().describe("ID do milestone"),
});

const paramsSchema = z.discriminatedUnion("action", [
  listParams,
  getParams,
  createParams,
  updateParams,
  deleteParams,
  issuesParams,
  mrsParams,
]);

const WRITE_ACTIONS = new Set(["create", "update", "delete"]);

export function createGitLabMilestonesTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_milestones: tool({
      description: [
        "Gerencia milestones de projetos GitLab.",
        "Ações: list, get, create, update, delete, issues, mrs.",
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

          const milestones = createMilestonesResource(client);

          switch (args.action) {
            case "list":
              return { milestones: await milestones.list(project, { state: args.state, per_page: args.per_page }) };

            case "get":
              return { milestone: await milestones.get(project, args.milestone_id) };

            case "create":
              return { milestone: await milestones.create(project, {
                title: args.title,
                description: args.description,
                due_date: args.due_date,
                start_date: args.start_date,
              }) };

            case "update":
              return { milestone: await milestones.update(project, args.milestone_id, {
                title: args.title,
                description: args.description,
                due_date: args.due_date,
                start_date: args.start_date,
                state_event: args.state_event,
              }) };

            case "delete":
              await milestones.delete(project, args.milestone_id);
              return { deleted: true };

            case "issues":
              return { issues: await milestones.issues(project, args.milestone_id) };

            case "mrs":
              return { merge_requests: await milestones.mrs(project, args.milestone_id) };
          }
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
