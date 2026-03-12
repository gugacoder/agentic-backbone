import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

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
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const id = await client.resolveProjectId(project);
          const params = new URLSearchParams({
            path: args.path ?? "",
            ref: args.ref ?? "HEAD",
            recursive: String(args.recursive ?? false),
            per_page: "100",
          });
          const data = await client.request(`/projects/${id}/repository/tree?${params}`);
          return { files: data };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
