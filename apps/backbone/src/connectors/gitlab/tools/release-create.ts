import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createReleasesResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabReleaseCreateTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_release_create: tool({
      description: "Cria uma nova release em um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        tag_name: z.string().describe("Nome da tag da release"),
        name: z.string().describe("Nome da release"),
        description: z.string().describe("Descrição da release (suporta Markdown)"),
        ref: z.string().optional().describe("Branch ou SHA de referência para criar a tag (se não existir)"),
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
          const release = await createReleasesResource(client).create(project, {
            tag_name: args.tag_name,
            name: args.name,
            description: args.description,
            ref: args.ref,
          });
          return { release };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
