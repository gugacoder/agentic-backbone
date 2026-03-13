import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createRepoCommitsResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabRepoListCommitsTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_repo_list_commits: tool({
      description: "Lista commits de um repositório GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        ref_name: z.string().optional().describe("Branch, tag ou commit SHA para filtrar"),
        since: z.string().optional().describe("Data de início ISO 8601"),
        until: z.string().optional().describe("Data de fim ISO 8601"),
        per_page: z.number().optional().default(20).describe("Número de resultados"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.adapter ?? defaultSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const commits = await createRepoCommitsResource(client).list(project, {
            ref_name: args.ref_name,
            since: args.since,
            until: args.until,
            per_page: args.per_page,
          });
          return { commits };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
