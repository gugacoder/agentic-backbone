import type { GitLabClient } from "../client.js";
import { JobSchema } from "../schemas/ci.js";

export function createCiJobsResource(client: GitLabClient) {
  async function resolveId(project: string) {
    return client.resolveProjectId(project);
  }

  return {
    async list(project: string, pipelineId: number, params?: { per_page?: number }) {
      const id = await resolveId(project);
      const qs = new URLSearchParams();
      if (params?.per_page) qs.set("per_page", String(params.per_page));
      const raw = await client.request<unknown[]>(`/projects/${id}/pipelines/${pipelineId}/jobs?${qs}`);
      return raw.map((r) => JobSchema.parse(r));
    },

    async get(project: string, jobId: number) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/jobs/${jobId}`);
      return JobSchema.parse(raw);
    },

    async log(project: string, jobId: number) {
      const id = await resolveId(project);
      return client.requestText(`/projects/${id}/jobs/${jobId}/trace`);
    },

    async retry(project: string, jobId: number) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/jobs/${jobId}/retry`, { method: "POST" });
      return JobSchema.parse(raw);
    },

    async cancel(project: string, jobId: number) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/jobs/${jobId}/cancel`, { method: "POST" });
      return JobSchema.parse(raw);
    },

    async play(project: string, jobId: number) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/jobs/${jobId}/play`, { method: "POST" });
      return JobSchema.parse(raw);
    },
  };
}
