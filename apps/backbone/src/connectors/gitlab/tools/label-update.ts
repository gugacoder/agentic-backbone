import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createLabelsResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabLabelUpdateTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_label_update: tool({
      description: "Atualiza uma label existente em um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        label_id: z.coerce.number().int().positive().describe("ID da label"),
        name: z.string().optional().describe("Novo nome da label"),
        color: z.string().optional().describe("Nova cor da label em formato hex"),
        description: z.string().optional().describe("Nova descrição da label"),
        priority: z.number().optional().describe("Nova prioridade da label"),
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
          const label = await createLabelsResource(client).update(project, args.label_id, {
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
