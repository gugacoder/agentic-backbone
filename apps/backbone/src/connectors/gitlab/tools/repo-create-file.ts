import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitLabRepoCreateFileTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_repo_create_file: tool({
      description: "Cria um novo arquivo em um repositório GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        file_path: z.string().describe("Caminho do arquivo no repositório"),
        content: z.string().describe("Conteúdo do arquivo"),
        branch: z.string().describe("Branch onde criar o arquivo"),
        commit_message: z.string().describe("Mensagem do commit"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const id = await client.resolveProjectId(project);
          const result = await client.request(`/projects/${id}/repository/files/${encodeURIComponent(args.file_path)}`, {
            method: "POST",
            body: JSON.stringify({
              branch: args.branch,
              content: Buffer.from(args.content).toString("base64"),
              commit_message: args.commit_message,
              encoding: "base64",
            }),
          });
          return { file_path: result.file_path, branch: result.branch };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
