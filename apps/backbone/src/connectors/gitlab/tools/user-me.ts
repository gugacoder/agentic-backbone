import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createUsersResource } from "@agentic-backbone/gitlab-v4";

export function createGitLabUserMeTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_user_me: tool({
      description: "Obtém informações do usuário autenticado no GitLab.",
      parameters: z.object({
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.adapter ?? defaultSlug) as any;
          const user = await createUsersResource(client).me();
          return { user };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
