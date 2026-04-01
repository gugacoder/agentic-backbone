import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitHubGetFileTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    github_get_file: tool({
      description: "Lê o conteúdo de um arquivo de um repositório GitHub.",
      parameters: z.object({
        path: z.string().describe("Caminho do arquivo no repositório"),
        ref: z.string().optional().describe("Branch, tag ou commit SHA"),
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
          const params = args.ref ? `?ref=${args.ref}` : "";
          const data = await client.request(`/repos/${repo}/contents/${args.path}${params}`);
          if (Array.isArray(data)) return { error: "Caminho aponta para um diretório, não um arquivo" };
          const content = Buffer.from(data.content, "base64").toString("utf-8");
          return { path: args.path, sha: data.sha, content };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
