import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import {
  createRepoFilesResource,
  createRepoBranchesResource,
  createRepoTagsResource,
  createRepoCommitsResource,
  createRepoCompareResource,
} from "@agentic-backbone/gitlab-v4";

const commonParams = z.object({
  project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
});

const getFileParams = z.object({ action: z.literal("get_file") }).merge(commonParams).extend({
  file_path: z.string().describe("Caminho do arquivo no repositório"),
  ref: z.string().optional().default("HEAD").describe("Branch, tag ou commit SHA"),
});

const listFilesParams = z.object({ action: z.literal("list_files") }).merge(commonParams).extend({
  path: z.string().optional().default("").describe("Diretório a listar"),
  ref: z.string().optional().default("HEAD").describe("Branch, tag ou commit SHA"),
  recursive: z.boolean().optional().default(false).describe("Listar recursivamente"),
  per_page: z.number().optional().default(100).describe("Número de resultados"),
});

const createFileParams = z.object({ action: z.literal("create_file") }).merge(commonParams).extend({
  file_path: z.string().describe("Caminho do arquivo no repositório"),
  content: z.string().describe("Conteúdo do arquivo"),
  branch: z.string().describe("Branch onde criar o arquivo"),
  commit_message: z.string().describe("Mensagem do commit"),
});

const updateFileParams = z.object({ action: z.literal("update_file") }).merge(commonParams).extend({
  file_path: z.string().describe("Caminho do arquivo no repositório"),
  content: z.string().describe("Novo conteúdo do arquivo"),
  branch: z.string().describe("Branch onde atualizar o arquivo"),
  commit_message: z.string().describe("Mensagem do commit"),
  last_commit_id: z.string().optional().describe("ID do último commit conhecido (para evitar conflitos)"),
});

const deleteFileParams = z.object({ action: z.literal("delete_file") }).merge(commonParams).extend({
  file_path: z.string().describe("Caminho do arquivo no repositório"),
  branch: z.string().describe("Branch onde excluir o arquivo"),
  commit_message: z.string().describe("Mensagem do commit"),
  author_name: z.string().optional().describe("Nome do autor do commit"),
  author_email: z.string().optional().describe("Email do autor do commit"),
});

const listBranchesParams = z.object({ action: z.literal("list_branches") }).merge(commonParams).extend({
  search: z.string().optional().describe("Filtro por nome da branch"),
  per_page: z.number().optional().default(20).describe("Número de resultados"),
});

const getBranchParams = z.object({ action: z.literal("get_branch") }).merge(commonParams).extend({
  branch: z.string().describe("Nome da branch"),
});

const createBranchParams = z.object({ action: z.literal("create_branch") }).merge(commonParams).extend({
  branch: z.string().describe("Nome da nova branch"),
  ref: z.string().describe("Branch, tag ou commit SHA de origem"),
});

const deleteBranchParams = z.object({ action: z.literal("delete_branch") }).merge(commonParams).extend({
  branch: z.string().describe("Nome da branch a excluir"),
});

const listTagsParams = z.object({ action: z.literal("list_tags") }).merge(commonParams).extend({
  per_page: z.number().optional().default(20).describe("Número de resultados"),
});

const getTagParams = z.object({ action: z.literal("get_tag") }).merge(commonParams).extend({
  tag_name: z.string().describe("Nome da tag"),
});

const createTagParams = z.object({ action: z.literal("create_tag") }).merge(commonParams).extend({
  tag_name: z.string().describe("Nome da nova tag"),
  ref: z.string().describe("Branch, tag ou commit SHA de referência"),
  message: z.string().optional().describe("Mensagem da tag anotada (opcional)"),
});

const deleteTagParams = z.object({ action: z.literal("delete_tag") }).merge(commonParams).extend({
  tag_name: z.string().describe("Nome da tag a excluir"),
});

const listCommitsParams = z.object({ action: z.literal("list_commits") }).merge(commonParams).extend({
  ref_name: z.string().optional().describe("Branch, tag ou commit SHA para filtrar"),
  since: z.string().optional().describe("Data de início ISO 8601"),
  until: z.string().optional().describe("Data de fim ISO 8601"),
  per_page: z.number().optional().default(20).describe("Número de resultados"),
});

const getCommitParams = z.object({ action: z.literal("get_commit") }).merge(commonParams).extend({
  sha: z.string().describe("SHA do commit"),
});

const commitDiffParams = z.object({ action: z.literal("commit_diff") }).merge(commonParams).extend({
  sha: z.string().describe("SHA do commit"),
});

const compareParams = z.object({ action: z.literal("compare") }).merge(commonParams).extend({
  from: z.string().describe("Ref de origem para comparação"),
  to: z.string().describe("Ref de destino para comparação"),
  straight: z.boolean().optional().describe("Usar diff direto (sem merge base)"),
});

const paramsSchema = z.discriminatedUnion("action", [
  getFileParams,
  listFilesParams,
  createFileParams,
  updateFileParams,
  deleteFileParams,
  listBranchesParams,
  getBranchParams,
  createBranchParams,
  deleteBranchParams,
  listTagsParams,
  getTagParams,
  createTagParams,
  deleteTagParams,
  listCommitsParams,
  getCommitParams,
  commitDiffParams,
  compareParams,
]);

const WRITE_ACTIONS = new Set([
  "create_file",
  "update_file",
  "delete_file",
  "create_branch",
  "delete_branch",
  "create_tag",
  "delete_tag",
]);

export function createGitLabRepoTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_repo: tool({
      description: [
        "Gerencia repositório GitLab: arquivos, branches, tags, commits e comparações.",
        "Ações: get_file, list_files, create_file, update_file, delete_file, list_branches, get_branch, create_branch, delete_branch, list_tags, get_tag, create_tag, delete_tag, list_commits, get_commit, commit_diff, compare.",
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

          const filesRes = createRepoFilesResource(client);
          const branchesRes = createRepoBranchesResource(client);
          const tagsRes = createRepoTagsResource(client);
          const commitsRes = createRepoCommitsResource(client);
          const compareRes = createRepoCompareResource(client);

          switch (args.action) {
            case "get_file": {
              const file = await filesRes.get(project, args.file_path, args.ref ?? "HEAD");
              return { file };
            }
            case "list_files": {
              const files = await commitsRes.listFiles(project, {
                path: args.path || undefined,
                ref: args.ref,
                recursive: args.recursive,
                per_page: args.per_page,
              });
              return { files };
            }
            case "create_file": {
              const result = await filesRes.create(project, args.file_path, {
                branch: args.branch,
                content: args.content,
                commit_message: args.commit_message,
              });
              return { result };
            }
            case "update_file": {
              const result = await filesRes.update(project, args.file_path, {
                branch: args.branch,
                content: args.content,
                commit_message: args.commit_message,
                last_commit_id: args.last_commit_id,
              });
              return { result };
            }
            case "delete_file": {
              await filesRes.delete(project, args.file_path, {
                branch: args.branch,
                commit_message: args.commit_message,
                author_name: args.author_name,
                author_email: args.author_email,
              });
              return { deleted: true };
            }
            case "list_branches": {
              const branches = await branchesRes.list(project, {
                search: args.search,
                per_page: args.per_page,
              });
              return { branches };
            }
            case "get_branch": {
              const branch = await branchesRes.get(project, args.branch);
              return { branch };
            }
            case "create_branch": {
              const branch = await branchesRes.create(project, {
                branch: args.branch,
                ref: args.ref,
              });
              return { branch };
            }
            case "delete_branch": {
              await branchesRes.delete(project, args.branch);
              return { deleted: true };
            }
            case "list_tags": {
              const tags = await tagsRes.list(project, { per_page: args.per_page });
              return { tags };
            }
            case "get_tag": {
              const tag = await tagsRes.get(project, args.tag_name);
              return { tag };
            }
            case "create_tag": {
              const tag = await tagsRes.create(project, {
                tag_name: args.tag_name,
                ref: args.ref,
                message: args.message,
              });
              return { tag };
            }
            case "delete_tag": {
              await tagsRes.delete(project, args.tag_name);
              return { deleted: true };
            }
            case "list_commits": {
              const commits = await commitsRes.list(project, {
                ref_name: args.ref_name,
                since: args.since,
                until: args.until,
                per_page: args.per_page,
              });
              return { commits };
            }
            case "get_commit": {
              const commit = await commitsRes.get(project, args.sha);
              return { commit };
            }
            case "commit_diff": {
              const diffs = await commitsRes.diff(project, args.sha);
              return { diffs };
            }
            case "compare": {
              const result = await compareRes.compare(project, args.from, args.to, args.straight);
              return { result };
            }
          }
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
