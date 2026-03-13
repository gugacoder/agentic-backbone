import type { GitLabClient } from "../client.js";
import { BranchSchema } from "../schemas/repo.js";

export function createRepoBranchesResource(client: GitLabClient) {
  async function resolveId(project: string) {
    return client.resolveProjectId(project);
  }

  return {
    async list(project: string, params?: { search?: string; per_page?: number }) {
      const id = await resolveId(project);
      const qs = new URLSearchParams();
      if (params?.search) qs.set("search", params.search);
      if (params?.per_page) qs.set("per_page", String(params.per_page));
      const raw = await client.request<unknown[]>(`/projects/${id}/repository/branches?${qs}`);
      return raw.map((r) => BranchSchema.parse(r));
    },

    async get(project: string, branch: string) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(
        `/projects/${id}/repository/branches/${encodeURIComponent(branch)}`,
      );
      return BranchSchema.parse(raw);
    },

    async create(project: string, body: { branch: string; ref: string }) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/repository/branches`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return BranchSchema.parse(raw);
    },

    async delete(project: string, branch: string) {
      const id = await resolveId(project);
      await client.request(`/projects/${id}/repository/branches/${encodeURIComponent(branch)}`, {
        method: "DELETE",
      });
    },
  };
}
