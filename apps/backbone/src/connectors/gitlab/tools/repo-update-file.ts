import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitLabRepoUpdateFileTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_repo_update_file: tool({
      description: "Atualiza o conteúdo de um arquivo existente em um repositório GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        file_path: z.string().describe("Caminho do arquivo no repositório"),
        content: z.string().describe("Novo conteúdo do arquivo"),
        branch: z.string().describe("Branch onde atualizar o arquivo"),
        commit_message: z.string().describe("Mensagem do commit"),
        last_commit_id: z.string().optional().describe("ID do último commit conhecido (para evitar conflitos)"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const id = await client.resolveProjectId(project);
          const body: Record<string, unknown> = {
            branch: args.branch,
            content: Buffer.from(args.content).toString("base64"),
            commit_message: args.commit_message,
            encoding: "base64",
          };
          if (args.last_commit_id) body.last_commit_id = args.last_commit_id;
          const result = await client.request(`/projects/${id}/repository/files/${encodeURIComponent(args.file_path)}`, {
            method: "PUT",
            body: JSON.stringify(body),
          });
          return { file_path: result.file_path, branch: result.branch };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
