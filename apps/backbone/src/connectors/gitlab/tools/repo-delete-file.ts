import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createRepoFilesResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabRepoDeleteFileTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_repo_delete_file: tool({
      description: "Exclui um arquivo de um repositório GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        file_path: z.string().describe("Caminho do arquivo no repositório"),
        branch: z.string().describe("Branch onde excluir o arquivo"),
        commit_message: z.string().describe("Mensagem do commit"),
        author_name: z.string().optional().describe("Nome do autor do commit"),
        author_email: z.string().optional().describe("Email do autor do commit"),
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
          await createRepoFilesResource(client).delete(project, args.file_path, {
            branch: args.branch,
            commit_message: args.commit_message,
            author_name: args.author_name,
            author_email: args.author_email,
          });
          return { deleted: true };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
