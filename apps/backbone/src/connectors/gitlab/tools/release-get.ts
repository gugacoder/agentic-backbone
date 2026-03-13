import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createReleasesResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabReleaseGetTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_release_get: tool({
      description: "Obtém detalhes de uma release específica de um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        tag_name: z.string().describe("Nome da tag da release"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.adapter ?? defaultSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const release = await createReleasesResource(client).get(project, args.tag_name);
          return { release };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
