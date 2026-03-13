import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createRepoFilesResource } from "@agentic-backbone/gitlab-v4";

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
          const adapter = adapters.find((a) => a.slug === adapterSlug);
          if (adapter?.policy === "readonly") return { error: "Adapter é readonly" };
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const result = await createRepoFilesResource(client).update(project, args.file_path, {
            branch: args.branch,
            content: args.content,
            commit_message: args.commit_message,
            last_commit_id: args.last_commit_id,
          });
          return { result };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
