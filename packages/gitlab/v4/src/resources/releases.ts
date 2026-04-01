import type { GitLabClient } from "../client.js";
import { ReleaseSchema } from "../schemas/release.js";

export function createReleasesResource(client: GitLabClient) {
  async function resolveId(project: string) {
    return client.resolveProjectId(project);
  }

  return {
    async list(project: string) {
      const id = await resolveId(project);
      const raw = await client.request<unknown[]>(`/projects/${id}/releases`);
      return raw.map((r) => ReleaseSchema.parse(r));
    },

    async get(project: string, tagName: string) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/releases/${encodeURIComponent(tagName)}`);
      return ReleaseSchema.parse(raw);
    },

    async create(project: string, body: {
      tag_name: string;
      name: string;
      description: string;
      ref?: string;
    }) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/releases`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return ReleaseSchema.parse(raw);
    },

    async update(project: string, tagName: string, body: {
      name?: string;
      description?: string;
    }) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/releases/${encodeURIComponent(tagName)}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      return ReleaseSchema.parse(raw);
    },

    async delete(project: string, tagName: string) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/releases/${encodeURIComponent(tagName)}`, {
        method: "DELETE",
      });
      return ReleaseSchema.parse(raw);
    },
  };
}
