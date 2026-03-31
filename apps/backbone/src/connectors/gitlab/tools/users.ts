import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createUsersResource } from "@agentic-backbone/gitlab-v4";

const meParams = z.object({ action: z.literal("me") });

const getParams = z.object({ action: z.literal("get") }).extend({
  user_id: z.coerce.number().int().positive().describe("ID do usuário"),
});

const searchParams = z.object({ action: z.literal("search") }).extend({
  query: z.string().describe("Termo de busca (nome ou username)"),
  per_page: z.number().optional().default(20).describe("Número de resultados por página"),
});

const paramsSchema = z.discriminatedUnion("action", [
  meParams,
  getParams,
  searchParams,
]);

export function createGitLabUsersTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_users: tool({
      description: [
        "Consulta usuários do GitLab.",
        "Ações: me (usuário autenticado), get (por ID), search (por nome/username).",
      ].join(" "),
      parameters: paramsSchema.and(z.object({
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
      })),
      execute: async (args) => {
        try {
          const adapterSlug = args.adapter ?? defaultSlug;
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const users = createUsersResource(client);

          switch (args.action) {
            case "me":
              return { user: await users.me() };

            case "get":
              return { user: await users.get(args.user_id) };

            case "search":
              return { users: await users.search(args.query, { per_page: args.per_page }) };
          }
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
