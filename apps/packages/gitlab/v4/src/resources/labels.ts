import type { GitLabClient } from "../client.js";
import { LabelSchema } from "../schemas/label.js";

export function createLabelsResource(client: GitLabClient) {
  async function resolveId(project: string) {
    return client.resolveProjectId(project);
  }

  return {
    async list(project: string, params?: { per_page?: number }) {
      const id = await resolveId(project);
      const qs = new URLSearchParams();
      if (params?.per_page) qs.set("per_page", String(params.per_page));
      const raw = await client.request<unknown[]>(`/projects/${id}/labels?${qs}`);
      return raw.map((r) => LabelSchema.parse(r));
    },

    async get(project: string, labelId: number) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/labels/${labelId}`);
      return LabelSchema.parse(raw);
    },

    async create(project: string, body: {
      name: string;
      color: string;
      description?: string;
      priority?: number;
    }) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/labels`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return LabelSchema.parse(raw);
    },

    async update(project: string, labelId: number, body: {
      name?: string;
      color?: string;
      description?: string;
      priority?: number;
    }) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/labels/${labelId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      return LabelSchema.parse(raw);
    },

    async delete(project: string, labelId: number) {
      const id = await resolveId(project);
      await client.request(`/projects/${id}/labels/${labelId}`, { method: "DELETE" });
    },
  };
}
