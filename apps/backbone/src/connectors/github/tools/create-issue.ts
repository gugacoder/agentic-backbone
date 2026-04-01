import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitHubCreateIssueTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    github_create_issue: tool({
      description: "Cria uma nova issue em um repositório GitHub.",
      parameters: z.object({
        title: z.string().describe("Título da issue"),
        body: z.string().optional().describe("Corpo da issue (suporta Markdown)"),
        labels: z.array(z.string()).optional().describe("Lista de labels"),
        assignees: z.array(z.string()).optional().describe("Lista de usernames para atribuir"),
        repo: z.string().optional().describe("Repositório no formato owner/repo (usa default do adapter se omitido)"),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitHub a usar"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const repo = args.repo ?? client.defaultRepo;
          if (!repo) return { error: "Repositório não especificado e sem default configurado" };
          const payload: Record<string, unknown> = { title: args.title };
          if (args.body) payload.body = args.body;
          if (args.labels) payload.labels = args.labels;
          if (args.assignees) payload.assignees = args.assignees;
          const issue = await client.request(`/repos/${repo}/issues`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          return { issue };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
