import type { GitLabClient } from "../client.js";
import { TagSchema } from "../schemas/repo.js";

export function createRepoTagsResource(client: GitLabClient) {
  async function resolveId(project: string) {
    return client.resolveProjectId(project);
  }

  return {
    async list(project: string, params?: { per_page?: number; sort?: "asc" | "desc" }) {
      const id = await resolveId(project);
      const qs = new URLSearchParams();
      if (params?.per_page) qs.set("per_page", String(params.per_page));
      if (params?.sort) qs.set("sort", params.sort);
      const raw = await client.request<unknown[]>(`/projects/${id}/repository/tags?${qs}`);
      return raw.map((r) => TagSchema.parse(r));
    },

    async get(project: string, tagName: string) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(
        `/projects/${id}/repository/tags/${encodeURIComponent(tagName)}`,
      );
      return TagSchema.parse(raw);
    },

    async create(project: string, body: { tag_name: string; ref: string; message?: string }) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/repository/tags`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return TagSchema.parse(raw);
    },

    async delete(project: string, tagName: string) {
      const id = await resolveId(project);
      await client.request(`/projects/${id}/repository/tags/${encodeURIComponent(tagName)}`, {
        method: "DELETE",
      });
    },
  };
}
