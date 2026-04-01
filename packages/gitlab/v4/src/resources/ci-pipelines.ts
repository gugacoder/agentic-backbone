import type { GitLabClient } from "../client.js";
import { PipelineSchema, PipelineStatusSchema } from "../schemas/ci.js";
import { z } from "zod";

export function createCiPipelinesResource(client: GitLabClient) {
  async function resolveId(project: string) {
    return client.resolveProjectId(project);
  }

  return {
    async list(project: string, params?: {
      ref?: string;
      status?: z.infer<typeof PipelineStatusSchema>;
      per_page?: number;
    }) {
      const id = await resolveId(project);
      const qs = new URLSearchParams();
      if (params?.ref) qs.set("ref", params.ref);
      if (params?.status) qs.set("status", params.status);
      if (params?.per_page) qs.set("per_page", String(params.per_page));
      const raw = await client.request<unknown[]>(`/projects/${id}/pipelines?${qs}`);
      return raw.map((r) => PipelineSchema.parse(r));
    },

    async get(project: string, pipelineId: number) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/pipelines/${pipelineId}`);
      return PipelineSchema.parse(raw);
    },

    async create(project: string, ref: string, variables?: Array<{ key: string; value: string }>) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/pipeline`, {
        method: "POST",
        body: JSON.stringify({ ref, variables }),
      });
      return PipelineSchema.parse(raw);
    },

    async retry(project: string, pipelineId: number) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/pipelines/${pipelineId}/retry`, {
        method: "POST",
      });
      return PipelineSchema.parse(raw);
    },

    async cancel(project: string, pipelineId: number) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/pipelines/${pipelineId}/cancel`, {
        method: "POST",
      });
      return PipelineSchema.parse(raw);
    },

    async delete(project: string, pipelineId: number) {
      const id = await resolveId(project);
      await client.request(`/projects/${id}/pipelines/${pipelineId}`, { method: "DELETE" });
    },
  };
}
