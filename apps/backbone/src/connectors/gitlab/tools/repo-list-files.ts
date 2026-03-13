import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createRepoCommitsResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabRepoListFilesTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_repo_list_files: tool({
      description: "Lista arquivos e diretórios de um repositório GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        path: z.string().optional().default("").describe("Diretório a listar"),
        ref: z.string().optional().default("HEAD").describe("Branch, tag ou commit SHA"),
        recursive: z.boolean().optional().default(false).describe("Listar recursivamente"),
        per_page: z.number().optional().default(100).describe("Número de resultados"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.adapter ?? defaultSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const files = await createRepoCommitsResource(client).listFiles(project, {
            path: args.path || undefined,
            ref: args.ref,
            recursive: args.recursive,
            per_page: args.per_page,
          });
          return { files };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
