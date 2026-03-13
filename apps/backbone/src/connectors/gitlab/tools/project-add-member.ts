import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createProjectsResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabProjectAddMemberTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_project_add_member: tool({
      description: "Adiciona um membro a um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        user_id: z.coerce.number().int().positive().describe("ID do usuário a adicionar"),
        access_level: z.number().describe("Nível de acesso (10=Guest, 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner)"),
        expires_at: z.string().optional().describe("Data de expiração do acesso (YYYY-MM-DD)"),
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
          const member = await createProjectsResource(client).addMember(project, {
            user_id: args.user_id,
            access_level: args.access_level,
            expires_at: args.expires_at,
          });
          return { member };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
