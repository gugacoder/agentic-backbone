import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createMrsResource, createMrNotesResource } from "../client.js";

const commonParams = z.object({
  project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
});

const listParams = z.object({ action: z.literal("list") }).merge(commonParams).extend({
  state: z.enum(["opened", "closed", "locked", "merged", "all"]).optional().default("opened").describe("Estado dos MRs"),
  labels: z.string().optional().describe("Labels separadas por vírgula"),
  per_page: z.number().optional().default(20).describe("Número de resultados (máximo 100)"),
});

const getParams = z.object({ action: z.literal("get") }).merge(commonParams).extend({
  mr_iid: z.coerce.number().int().positive().describe("IID do merge request no projeto"),
});

const createParams = z.object({ action: z.literal("create") }).merge(commonParams).extend({
  source_branch: z.string().describe("Branch de origem"),
  target_branch: z.string().describe("Branch de destino"),
  title: z.string().describe("Título do merge request"),
  description: z.string().optional().describe("Descrição do merge request (suporta Markdown)"),
  remove_source_branch: z.boolean().optional().describe("Remover source branch após merge"),
});

const updateParams = z.object({ action: z.literal("update") }).merge(commonParams).extend({
  mr_iid: z.coerce.number().int().positive().describe("IID do merge request no projeto"),
  title: z.string().optional().describe("Novo título do merge request"),
  description: z.string().optional().describe("Nova descrição do merge request"),
  labels: z.string().optional().describe("Labels separadas por vírgula"),
  assignee_ids: z.array(z.number()).optional().describe("IDs de usuários para atribuir"),
  state_event: z.enum(["reopen", "close"]).optional().describe("Ação de estado: reopen ou close"),
});

const deleteParams = z.object({ action: z.literal("delete") }).merge(commonParams).extend({
  mr_iid: z.coerce.number().int().positive().describe("IID do merge request no projeto"),
});

const mergeParams = z.object({ action: z.literal("merge") }).merge(commonParams).extend({
  mr_iid: z.coerce.number().int().positive().describe("IID do merge request no projeto"),
  merge_commit_message: z.string().optional().describe("Mensagem do commit de merge"),
  should_remove_source_branch: z.boolean().optional().describe("Remover branch de origem após merge"),
  squash: z.boolean().optional().default(false).describe("Squash commits ao fazer merge"),
});

const approveParams = z.object({ action: z.literal("approve") }).merge(commonParams).extend({
  mr_iid: z.coerce.number().int().positive().describe("IID do merge request no projeto"),
});

const unapproveParams = z.object({ action: z.literal("unapprove") }).merge(commonParams).extend({
  mr_iid: z.coerce.number().int().positive().describe("IID do merge request no projeto"),
});

const approvalsParams = z.object({ action: z.literal("approvals") }).merge(commonParams).extend({
  mr_iid: z.coerce.number().int().positive().describe("IID do merge request no projeto"),
});

const rebaseParams = z.object({ action: z.literal("rebase") }).merge(commonParams).extend({
  mr_iid: z.coerce.number().int().positive().describe("IID do merge request no projeto"),
});

const diffParams = z.object({ action: z.literal("diff") }).merge(commonParams).extend({
  mr_iid: z.coerce.number().int().positive().describe("IID do merge request no projeto"),
});

const pipelinesParams = z.object({ action: z.literal("pipelines") }).merge(commonParams).extend({
  mr_iid: z.coerce.number().int().positive().describe("IID do merge request no projeto"),
});

const commentParams = z.object({ action: z.literal("comment") }).merge(commonParams).extend({
  mr_iid: z.coerce.number().int().positive().describe("IID do merge request no projeto"),
  body: z.string().describe("Texto do comentário"),
});

const listCommentsParams = z.object({ action: z.literal("list_comments") }).merge(commonParams).extend({
  mr_iid: z.coerce.number().int().positive().describe("IID do merge request no projeto"),
});

const updateCommentParams = z.object({ action: z.literal("update_comment") }).merge(commonParams).extend({
  mr_iid: z.coerce.number().int().positive().describe("IID do merge request no projeto"),
  note_id: z.coerce.number().int().positive().describe("ID do comentário (note)"),
  body: z.string().describe("Novo texto do comentário"),
});

const deleteCommentParams = z.object({ action: z.literal("delete_comment") }).merge(commonParams).extend({
  mr_iid: z.coerce.number().int().positive().describe("IID do merge request no projeto"),
  note_id: z.coerce.number().int().positive().describe("ID do comentário (note)"),
});

const paramsSchema = z.discriminatedUnion("action", [
  listParams,
  getParams,
  createParams,
  updateParams,
  deleteParams,
  mergeParams,
  approveParams,
  unapproveParams,
  approvalsParams,
  rebaseParams,
  diffParams,
  pipelinesParams,
  commentParams,
  listCommentsParams,
  updateCommentParams,
  deleteCommentParams,
]);

const WRITE_ACTIONS = new Set(["create", "update", "delete", "merge", "approve", "unapprove", "rebase", "comment", "update_comment", "delete_comment"]);

export function createGitLabMrsTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_mrs: tool({
      description: [
        "Gerencia merge requests do GitLab.",
        "Ações: list, get, create, update, delete, merge, approve, unapprove, approvals, rebase, diff, pipelines, comment, list_comments, update_comment, delete_comment.",
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

          const mrsRes = createMrsResource(client);
          const notesRes = createMrNotesResource(client);

          switch (args.action) {
            case "list": {
              const merge_requests = await mrsRes.list(project, {
                state: args.state,
                labels: args.labels,
                per_page: args.per_page,
              });
              return { merge_requests };
            }
            case "get": {
              const merge_request = await mrsRes.get(project, args.mr_iid);
              return { merge_request };
            }
            case "create": {
              const merge_request = await mrsRes.create(project, {
                source_branch: args.source_branch,
                target_branch: args.target_branch,
                title: args.title,
                description: args.description,
                remove_source_branch: args.remove_source_branch,
              });
              return { merge_request };
            }
            case "update": {
              const merge_request = await mrsRes.update(project, args.mr_iid, {
                title: args.title,
                description: args.description,
                labels: args.labels,
                assignee_ids: args.assignee_ids,
                state_event: args.state_event,
              });
              return { merge_request };
            }
            case "delete": {
              await mrsRes.delete(project, args.mr_iid);
              return { deleted: true };
            }
            case "merge": {
              const merge_request = await mrsRes.merge(project, args.mr_iid, {
                merge_commit_message: args.merge_commit_message,
                should_remove_source_branch: args.should_remove_source_branch,
                squash: args.squash,
              });
              return { merge_request };
            }
            case "approve": {
              const approvals = await mrsRes.approve(project, args.mr_iid);
              return { approvals };
            }
            case "unapprove": {
              await mrsRes.unapprove(project, args.mr_iid);
              return { unapproved: true };
            }
            case "approvals": {
              const approvals = await mrsRes.approvals(project, args.mr_iid);
              return { approvals };
            }
            case "rebase": {
              await mrsRes.rebase(project, args.mr_iid);
              return { rebased: true };
            }
            case "diff": {
              const diffs = await mrsRes.diff(project, args.mr_iid);
              return { diffs };
            }
            case "pipelines": {
              const pipelines = await mrsRes.pipelines(project, args.mr_iid);
              return { pipelines };
            }
            case "comment": {
              const note = await notesRes.create(project, args.mr_iid, args.body);
              return { note };
            }
            case "list_comments": {
              const notes = await notesRes.list(project, args.mr_iid);
              return { notes };
            }
            case "update_comment": {
              const note = await notesRes.update(project, args.mr_iid, args.note_id, args.body);
              return { note };
            }
            case "delete_comment": {
              await notesRes.delete(project, args.mr_iid, args.note_id);
              return { deleted: true };
            }
          }
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
