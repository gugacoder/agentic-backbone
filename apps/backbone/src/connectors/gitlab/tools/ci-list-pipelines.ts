import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitLabCiListPipelinesTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_ci_list_pipelines: tool({
      description: "Lista pipelines CI/CD de um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        ref: z.string().optional().describe("Filtrar por branch/tag"),
        status: z.enum(["created", "waiting_for_resource", "preparing", "pending", "running", "success", "failed", "canceled", "skipped", "manual", "scheduled"]).optional().describe("Filtrar por status do pipeline"),
        per_page: z.number().optional().default(20).describe("Número de resultados"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const id = await client.resolveProjectId(project);
          const params = new URLSearchParams({ per_page: String(args.per_page ?? 20) });
          if (args.ref) params.set("ref", args.ref);
          if (args.status) params.set("status", args.status);
          const data = await client.request<any[]>(`/projects/${id}/pipelines?${params}`);
          return {
            pipelines: data.map((p) => ({
              id: p.id,
              status: p.status,
              ref: p.ref,
              sha: p.sha,
              created_at: p.created_at,
              updated_at: p.updated_at,
              web_url: p.web_url,
            })),
          };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
