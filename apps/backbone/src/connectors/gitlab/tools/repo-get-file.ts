import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createRepoFilesResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabRepoGetFileTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_repo_get_file: tool({
      description: "Lê o conteúdo de um arquivo de um repositório GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        file_path: z.string().describe("Caminho do arquivo no repositório"),
        ref: z.string().optional().default("HEAD").describe("Branch, tag ou commit SHA"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.adapter ?? defaultSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const file = await createRepoFilesResource(client).get(project, args.file_path, args.ref ?? "HEAD");
          return { file };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
