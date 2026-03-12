import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createGitLabCiTriggerPipelineTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_ci_trigger_pipeline: tool({
      description: "Dispara um pipeline CI/CD em um projeto GitLab.",
      parameters: z.object({
        project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab a usar"),
        ref: z.string().describe("Branch, tag ou commit SHA para executar o pipeline"),
        variables: z.record(z.string()).optional().describe("Variáveis de ambiente para o pipeline"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };
          const id = await client.resolveProjectId(project);
          const body: Record<string, unknown> = { ref: args.ref };
          if (args.variables) {
            body.variables = Object.entries(args.variables).map(([key, value]) => ({ key, value, variable_type: "env_var" }));
          }
          const result = await client.request(`/projects/${id}/pipeline`, {
            method: "POST",
            body: JSON.stringify(body),
          });
          return { pipeline: { id: result.id, status: result.status, ref: result.ref, sha: result.sha, web_url: result.web_url } };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
