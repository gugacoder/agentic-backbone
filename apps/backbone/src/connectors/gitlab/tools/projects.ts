import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createProjectsResource } from "@agentic-backbone/gitlab-v4";

const WRITE_ACTIONS = new Set(["add_member", "update_member", "remove_member"]);

const searchParams = z.object({
  action: z.literal("search"),
  query: z.string().describe("Termo de busca"),
  per_page: z.number().optional().default(20).describe("Número de resultados"),
});

const getParams = z.object({
  action: z.literal("get"),
  project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
});

const listMembersParams = z.object({
  action: z.literal("list_members"),
  project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
  per_page: z.number().optional().default(20).describe("Número de resultados"),
});

const addMemberParams = z.object({
  action: z.literal("add_member"),
  project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
  user_id: z.coerce.number().int().positive().describe("ID do usuário a adicionar"),
  access_level: z.number().describe("Nível de acesso (10=Guest, 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner)"),
  expires_at: z.string().optional().describe("Data de expiração do acesso (YYYY-MM-DD)"),
});

const updateMemberParams = z.object({
  action: z.literal("update_member"),
  project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
  user_id: z.coerce.number().int().positive().describe("ID do usuário"),
  access_level: z.number().describe("Novo nível de acesso (10=Guest, 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner)"),
  expires_at: z.string().optional().describe("Nova data de expiração do acesso (YYYY-MM-DD)"),
});

const removeMemberParams = z.object({
  action: z.literal("remove_member"),
  project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
  user_id: z.coerce.number().int().positive().describe("ID do usuário a remover"),
});

const paramsSchema = z.discriminatedUnion("action", [
  searchParams,
  getParams,
  listMembersParams,
  addMemberParams,
  updateMemberParams,
  removeMemberParams,
]);

export function createGitLabProjectsTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_projects: tool({
      description: [
        "Gerencia projetos do GitLab.",
        "Ações: search (buscar projetos), get (obter detalhes), list_members (listar membros), add_member (adicionar membro), update_member (atualizar acesso), remove_member (remover membro).",
      ].join(" "),
      parameters: paramsSchema.and(z.object({
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
      })),
      execute: async (args) => {
        try {
          const adapterSlug = args.adapter ?? defaultSlug;
          if (WRITE_ACTIONS.has(args.action)) {
            const adapter = adapters.find((a) => a.slug === adapterSlug);
            if (adapter?.policy === "readonly") return { error: "Adapter é readonly" };
          }
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const projects = createProjectsResource(client);

          switch (args.action) {
            case "search":
              return { projects: await projects.search(args.query, { per_page: args.per_page }) };

            case "get": {
              const project = args.project ?? client.defaultProject;
              if (!project) return { error: "Projeto não especificado e sem default configurado" };
              return { project: await projects.get(project) };
            }

            case "list_members": {
              const project = args.project ?? client.defaultProject;
              if (!project) return { error: "Projeto não especificado e sem default configurado" };
              return { members: await projects.listMembers(project, { per_page: args.per_page }) };
            }

            case "add_member": {
              const project = args.project ?? client.defaultProject;
              if (!project) return { error: "Projeto não especificado e sem default configurado" };
              return { member: await projects.addMember(project, { user_id: args.user_id, access_level: args.access_level, expires_at: args.expires_at }) };
            }

            case "update_member": {
              const project = args.project ?? client.defaultProject;
              if (!project) return { error: "Projeto não especificado e sem default configurado" };
              return { member: await projects.updateMember(project, args.user_id, { access_level: args.access_level, expires_at: args.expires_at }) };
            }

            case "remove_member": {
              const project = args.project ?? client.defaultProject;
              if (!project) return { error: "Projeto não especificado e sem default configurado" };
              await projects.removeMember(project, args.user_id);
              return { deleted: true };
            }
          }
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
