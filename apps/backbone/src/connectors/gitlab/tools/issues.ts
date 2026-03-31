import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createIssuesResource, createIssueNotesResource } from "@agentic-backbone/gitlab-v4";

const commonParams = z.object({
  project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
});

const listParams = z.object({ action: z.literal("list") }).merge(commonParams).extend({
  state: z.enum(["opened", "closed", "all"]).optional().default("opened").describe("Estado das issues"),
  labels: z.string().optional().describe("Labels separadas por vírgula"),
  assignee_username: z.string().optional().describe("Username do assignee para filtrar"),
  milestone: z.string().optional().describe("Título do milestone para filtrar"),
  per_page: z.number().optional().default(20).describe("Número de resultados (máximo 100)"),
});

const getParams = z.object({ action: z.literal("get") }).merge(commonParams).extend({
  issue_iid: z.coerce.number().int().positive().describe("IID da issue no projeto"),
});

const createParams = z.object({ action: z.literal("create") }).merge(commonParams).extend({
  title: z.string().describe("Título da issue"),
  description: z.string().optional().describe("Descrição da issue (suporta Markdown)"),
  labels: z.string().optional().describe("Labels separadas por vírgula"),
  assignee_ids: z.array(z.number()).optional().describe("IDs de usuários para atribuir"),
  milestone_id: z.number().optional().describe("ID do milestone"),
  due_date: z.string().optional().describe("Data de vencimento (YYYY-MM-DD)"),
});

const updateParams = z.object({ action: z.literal("update") }).merge(commonParams).extend({
  issue_iid: z.coerce.number().int().positive().describe("IID da issue no projeto"),
  title: z.string().optional().describe("Novo título da issue"),
  description: z.string().optional().describe("Nova descrição da issue"),
  state_event: z.enum(["reopen", "close"]).optional().describe("Ação de estado: reopen ou close"),
  labels: z.string().optional().describe("Labels separadas por vírgula"),
  assignee_ids: z.array(z.number()).optional().describe("IDs de usuários para atribuir"),
  milestone_id: z.number().optional().describe("ID do milestone"),
  due_date: z.string().optional().describe("Data de vencimento (YYYY-MM-DD)"),
});

const deleteParams = z.object({ action: z.literal("delete") }).merge(commonParams).extend({
  issue_iid: z.coerce.number().int().positive().describe("IID da issue no projeto"),
});

const moveParams = z.object({ action: z.literal("move") }).merge(commonParams).extend({
  issue_iid: z.coerce.number().int().positive().describe("IID da issue no projeto"),
  to_project_id: z.number().describe("ID do projeto destino"),
});

const commentParams = z.object({ action: z.literal("comment") }).merge(commonParams).extend({
  issue_iid: z.coerce.number().int().positive().describe("IID da issue no projeto"),
  body: z.string().describe("Texto do comentário"),
});

const listCommentsParams = z.object({ action: z.literal("list_comments") }).merge(commonParams).extend({
  issue_iid: z.coerce.number().int().positive().describe("IID da issue no projeto"),
});

const updateCommentParams = z.object({ action: z.literal("update_comment") }).merge(commonParams).extend({
  issue_iid: z.coerce.number().int().positive().describe("IID da issue no projeto"),
  note_id: z.coerce.number().int().positive().describe("ID do comentário (note)"),
  body: z.string().describe("Novo texto do comentário"),
});

const deleteCommentParams = z.object({ action: z.literal("delete_comment") }).merge(commonParams).extend({
  issue_iid: z.coerce.number().int().positive().describe("IID da issue no projeto"),
  note_id: z.coerce.number().int().positive().describe("ID do comentário (note)"),
});

const listLinksParams = z.object({ action: z.literal("list_links") }).merge(commonParams).extend({
  issue_iid: z.coerce.number().int().positive().describe("IID da issue no projeto"),
});

const addLinkParams = z.object({ action: z.literal("add_link") }).merge(commonParams).extend({
  issue_iid: z.coerce.number().int().positive().describe("IID da issue de origem no projeto"),
  target_project_id: z.number().describe("ID do projeto da issue destino"),
  target_issue_iid: z.coerce.number().int().positive().describe("IID da issue destino"),
  link_type: z.enum(["relates_to", "blocks", "is_blocked_by"]).optional().describe("Tipo de link"),
});

const relatedMrsParams = z.object({ action: z.literal("related_mrs") }).merge(commonParams).extend({
  issue_iid: z.coerce.number().int().positive().describe("IID da issue no projeto"),
});

const paramsSchema = z.discriminatedUnion("action", [
  listParams,
  getParams,
  createParams,
  updateParams,
  deleteParams,
  moveParams,
  commentParams,
  listCommentsParams,
  updateCommentParams,
  deleteCommentParams,
  listLinksParams,
  addLinkParams,
  relatedMrsParams,
]);

const WRITE_ACTIONS = new Set(["create", "update", "delete", "move", "comment", "update_comment", "delete_comment", "add_link"]);

export function createGitLabIssuesTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_issues: tool({
      description: [
        "Gerencia issues do GitLab.",
        "Ações: list, get, create, update, delete, move, comment, list_comments, update_comment, delete_comment, list_links, add_link, related_mrs.",
      ].join(" "),
      parameters: paramsSchema.and(z.object({
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
      })),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;

          if (WRITE_ACTIONS.has(args.action)) {
            const adapter = adapters.find((a) => a.slug === adapterSlug);
            if (adapter?.policy === "readonly") return { error: "Adapter é readonly" };
          }

          const client = connectorRegistry.createClient(adapterSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };

          const issuesRes = createIssuesResource(client);
          const notesRes = createIssueNotesResource(client);

          switch (args.action) {
            case "list": {
              const issues = await issuesRes.list(project, {
                state: args.state,
                labels: args.labels,
                assignee_username: args.assignee_username,
                milestone: args.milestone,
                per_page: args.per_page,
              });
              const simplified = issues.map(({ id: _id, ...rest }) => rest);
              return { issues: simplified };
            }
            case "get": {
              const issue = await issuesRes.get(project, args.issue_iid);
              return { issue };
            }
            case "create": {
              const issue = await issuesRes.create(project, {
                title: args.title,
                description: args.description,
                labels: args.labels,
                assignee_ids: args.assignee_ids,
                milestone_id: args.milestone_id,
                due_date: args.due_date,
              });
              return { issue };
            }
            case "update": {
              const issue = await issuesRes.update(project, args.issue_iid, {
                title: args.title,
                description: args.description,
                state_event: args.state_event,
                labels: args.labels,
                assignee_ids: args.assignee_ids,
                milestone_id: args.milestone_id,
                due_date: args.due_date,
              });
              return { issue };
            }
            case "delete": {
              await issuesRes.delete(project, args.issue_iid);
              return { deleted: true };
            }
            case "move": {
              const issue = await issuesRes.move(project, args.issue_iid, args.to_project_id);
              return { issue };
            }
            case "comment": {
              const note = await notesRes.create(project, args.issue_iid, args.body);
              return { note };
            }
            case "list_comments": {
              const notes = await notesRes.list(project, args.issue_iid);
              return { notes };
            }
            case "update_comment": {
              const note = await notesRes.update(project, args.issue_iid, args.note_id, args.body);
              return { note };
            }
            case "delete_comment": {
              await notesRes.delete(project, args.issue_iid, args.note_id);
              return { deleted: true };
            }
            case "list_links": {
              const links = await issuesRes.listLinks(project, args.issue_iid);
              return { links };
            }
            case "add_link": {
              const link = await issuesRes.addLink(project, args.issue_iid, args.target_project_id, args.target_issue_iid, args.link_type);
              return { link };
            }
            case "related_mrs": {
              const merge_requests = await issuesRes.relatedMrs(project, args.issue_iid);
              return { merge_requests };
            }
          }
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
