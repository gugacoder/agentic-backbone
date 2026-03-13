import type { GitLabClient } from "../client.js";
import { CommitSchema, CommitDiffSchema, TreeItemSchema } from "../schemas/repo.js";

export function createRepoCommitsResource(client: GitLabClient) {
  async function resolveId(project: string) {
    return client.resolveProjectId(project);
  }

  return {
    async list(project: string, params?: {
      ref_name?: string;
      since?: string;
      until?: string;
      per_page?: number;
    }) {
      const id = await resolveId(project);
      const qs = new URLSearchParams();
      if (params?.ref_name) qs.set("ref_name", params.ref_name);
      if (params?.since) qs.set("since", params.since);
      if (params?.until) qs.set("until", params.until);
      if (params?.per_page) qs.set("per_page", String(params.per_page));
      const raw = await client.request<unknown[]>(`/projects/${id}/repository/commits?${qs}`);
      return raw.map((r) => CommitSchema.parse(r));
    },

    async get(project: string, sha: string) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/repository/commits/${sha}`);
      return CommitSchema.parse(raw);
    },

    async diff(project: string, sha: string) {
      const id = await resolveId(project);
      const raw = await client.request<unknown[]>(`/projects/${id}/repository/commits/${sha}/diff`);
      return raw.map((r) => CommitDiffSchema.parse(r));
    },

    async listFiles(project: string, params?: {
      path?: string;
      ref?: string;
      recursive?: boolean;
      per_page?: number;
    }) {
      const id = await resolveId(project);
      const qs = new URLSearchParams();
      if (params?.path) qs.set("path", params.path);
      if (params?.ref) qs.set("ref", params.ref);
      if (params?.recursive !== undefined) qs.set("recursive", String(params.recursive));
      if (params?.per_page) qs.set("per_page", String(params.per_page));
      const raw = await client.request<unknown[]>(`/projects/${id}/repository/tree?${qs}`);
      return raw.map((r) => TreeItemSchema.parse(r));
    },
  };
}
