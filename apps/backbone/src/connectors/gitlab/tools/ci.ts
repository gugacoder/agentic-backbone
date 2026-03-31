import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { createCiPipelinesResource, createCiJobsResource } from "@agentic-backbone/gitlab-v4";

const commonParams = z.object({
  project: z.string().optional().describe("Projeto (path completo como owner/repo ou ID numérico). Usa default do adapter se omitido."),
});

const listPipelinesParams = z.object({ action: z.literal("list_pipelines") }).merge(commonParams).extend({
  ref: z.string().optional().describe("Filtrar por branch/tag"),
  status: z.enum(["created", "waiting_for_resource", "preparing", "pending", "running", "success", "failed", "canceled", "skipped", "manual", "scheduled"]).optional().describe("Filtrar por status do pipeline"),
  per_page: z.number().optional().default(20).describe("Número de resultados"),
});

const getPipelineParams = z.object({ action: z.literal("get_pipeline") }).merge(commonParams).extend({
  pipeline_id: z.coerce.number().int().positive().describe("ID do pipeline"),
});

const triggerPipelineParams = z.object({ action: z.literal("trigger_pipeline") }).merge(commonParams).extend({
  ref: z.string().describe("Branch, tag ou commit SHA para executar o pipeline"),
  variables: z.record(z.string()).optional().describe("Variáveis de ambiente para o pipeline"),
});

const deletePipelineParams = z.object({ action: z.literal("delete_pipeline") }).merge(commonParams).extend({
  pipeline_id: z.coerce.number().int().positive().describe("ID do pipeline"),
});

const retryPipelineParams = z.object({ action: z.literal("retry_pipeline") }).merge(commonParams).extend({
  pipeline_id: z.coerce.number().int().positive().describe("ID do pipeline"),
});

const cancelPipelineParams = z.object({ action: z.literal("cancel_pipeline") }).merge(commonParams).extend({
  pipeline_id: z.coerce.number().int().positive().describe("ID do pipeline"),
});

const listJobsParams = z.object({ action: z.literal("list_jobs") }).merge(commonParams).extend({
  pipeline_id: z.coerce.number().int().positive().describe("ID do pipeline"),
  per_page: z.number().optional().default(20).describe("Número de resultados"),
});

const getJobParams = z.object({ action: z.literal("get_job") }).merge(commonParams).extend({
  job_id: z.coerce.number().int().positive().describe("ID do job"),
});

const jobLogParams = z.object({ action: z.literal("job_log") }).merge(commonParams).extend({
  job_id: z.coerce.number().int().positive().describe("ID do job"),
});

const retryJobParams = z.object({ action: z.literal("retry_job") }).merge(commonParams).extend({
  job_id: z.coerce.number().int().positive().describe("ID do job"),
});

const cancelJobParams = z.object({ action: z.literal("cancel_job") }).merge(commonParams).extend({
  job_id: z.coerce.number().int().positive().describe("ID do job"),
});

const playJobParams = z.object({ action: z.literal("play_job") }).merge(commonParams).extend({
  job_id: z.coerce.number().int().positive().describe("ID do job"),
});

const paramsSchema = z.discriminatedUnion("action", [
  listPipelinesParams,
  getPipelineParams,
  triggerPipelineParams,
  deletePipelineParams,
  retryPipelineParams,
  cancelPipelineParams,
  listJobsParams,
  getJobParams,
  jobLogParams,
  retryJobParams,
  cancelJobParams,
  playJobParams,
]);

const WRITE_ACTIONS = new Set(["trigger_pipeline", "delete_pipeline", "retry_pipeline", "cancel_pipeline", "retry_job", "cancel_job", "play_job"]);

export function createGitLabCiTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_ci: tool({
      description: [
        "Gerencia CI/CD do GitLab.",
        "Ações: list_pipelines, get_pipeline, trigger_pipeline, delete_pipeline, retry_pipeline, cancel_pipeline,",
        "list_jobs, get_job, job_log, retry_job, cancel_job, play_job.",
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
          const project = args.project ?? client.defaultProject;
          if (!project) return { error: "Projeto não especificado e sem default configurado" };

          const pipelines = createCiPipelinesResource(client);
          const jobs = createCiJobsResource(client);

          switch (args.action) {
            case "list_pipelines":
              return { pipelines: await pipelines.list(project, { ref: args.ref, status: args.status, per_page: args.per_page }) };

            case "get_pipeline":
              return { pipeline: await pipelines.get(project, args.pipeline_id) };

            case "trigger_pipeline": {
              const sdkVariables = args.variables
                ? Object.entries(args.variables).map(([key, value]) => ({ key, value }))
                : undefined;
              return { pipeline: await pipelines.create(project, args.ref, sdkVariables) };
            }

            case "delete_pipeline":
              await pipelines.delete(project, args.pipeline_id);
              return { deleted: true };

            case "retry_pipeline":
              return { pipeline: await pipelines.retry(project, args.pipeline_id) };

            case "cancel_pipeline":
              return { pipeline: await pipelines.cancel(project, args.pipeline_id) };

            case "list_jobs":
              return { jobs: await jobs.list(project, args.pipeline_id, { per_page: args.per_page }) };

            case "get_job":
              return { job: await jobs.get(project, args.job_id) };

            case "job_log": {
              const logStr = await jobs.log(project, args.job_id);
              const truncated = logStr.length > 10000;
              return { job_id: args.job_id, truncated, log: logStr.slice(0, 10000) };
            }

            case "retry_job":
              return { job: await jobs.retry(project, args.job_id) };

            case "cancel_job":
              return { job: await jobs.cancel(project, args.job_id) };

            case "play_job":
              return { job: await jobs.play(project, args.job_id) };
          }
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
