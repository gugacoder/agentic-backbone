import type { GitLabClient } from "../client.js";
import { ProjectSchema, ProjectMemberSchema } from "../schemas/project.js";

export function createProjectsResource(client: GitLabClient) {
  return {
    async search(query: string, params?: { per_page?: number }) {
      const qs = new URLSearchParams({ search: query });
      if (params?.per_page) qs.set("per_page", String(params.per_page));
      const raw = await client.request<unknown[]>(`/projects?${qs}`);
      return raw.map((r) => ProjectSchema.parse(r));
    },

    async get(project: string) {
      const id = await client.resolveProjectId(project);
      const raw = await client.request<unknown>(`/projects/${id}`);
      return ProjectSchema.parse(raw);
    },

    async listMembers(project: string, params?: { per_page?: number }) {
      const id = await client.resolveProjectId(project);
      const qs = new URLSearchParams();
      if (params?.per_page) qs.set("per_page", String(params.per_page));
      const raw = await client.request<unknown[]>(`/projects/${id}/members?${qs}`);
      return raw.map((r) => ProjectMemberSchema.parse(r));
    },

    async addMember(project: string, body: {
      user_id: number;
      access_level: number;
      expires_at?: string;
    }) {
      const id = await client.resolveProjectId(project);
      const raw = await client.request<unknown>(`/projects/${id}/members`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return ProjectMemberSchema.parse(raw);
    },

    async updateMember(project: string, userId: number, body: {
      access_level: number;
      expires_at?: string;
    }) {
      const id = await client.resolveProjectId(project);
      const raw = await client.request<unknown>(`/projects/${id}/members/${userId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      return ProjectMemberSchema.parse(raw);
    },

    async removeMember(project: string, userId: number) {
      const id = await client.resolveProjectId(project);
      await client.request(`/projects/${id}/members/${userId}`, { method: "DELETE" });
    },
  };
}
