import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitLabMrListTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_mr_list: tool({
      description: "Lista merge requests de um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        state: z.enum(["opened", "closed", "merged", "all"]).optional().default("opened").describe("Estado dos MRs"),
        labels: z.string().optional().describe("Labels separadas por vírgula"),
        per_page: z.number().optional().default(20).describe("Número de resultados (máximo 100)"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const id = await client.resolveProjectId(project);
          const params = new URLSearchParams({
            state: args.state ?? "opened",
            per_page: String(args.per_page ?? 20),
          });
          if (args.labels) params.set("labels", args.labels);
          const merge_requests = await client.request(`/projects/${id}/merge_requests?${params}`);
          return { merge_requests };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
