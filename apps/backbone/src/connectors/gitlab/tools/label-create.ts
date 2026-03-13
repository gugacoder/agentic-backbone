import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createLabelsResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabLabelCreateTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_label_create: tool({
      description: "Cria uma nova label em um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        name: z.string().describe("Nome da label"),
        color: z.string().describe("Cor da label em formato hex (ex: #FF0000)"),
        description: z.string().optional().describe("Descrição da label"),
        priority: z.number().optional().describe("Prioridade da label"),
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
          const label = await createLabelsResource(client).create(project, {
            name: args.name,
            color: args.color,
            description: args.description,
            priority: args.priority,
          });
          return { label };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
