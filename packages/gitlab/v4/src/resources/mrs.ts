import type { GitLabClient } from "../client.js";
import { MrSchema, MrDiffSchema, MrApprovalsSchema } from "../schemas/mr.js";
import { PipelineSchema } from "../schemas/ci.js";

export function createMrsResource(client: GitLabClient) {
  async function resolveId(project: string) {
    return client.resolveProjectId(project);
  }

  return {
    async list(project: string, params?: {
      state?: "opened" | "closed" | "locked" | "merged" | "all";
      labels?: string;
      per_page?: number;
    }) {
      const id = await resolveId(project);
      const qs = new URLSearchParams();
      if (params?.state) qs.set("state", params.state);
      if (params?.labels) qs.set("labels", params.labels);
      if (params?.per_page) qs.set("per_page", String(params.per_page));
      const raw = await client.request<unknown[]>(`/projects/${id}/merge_requests?${qs}`);
      return raw.map((r) => MrSchema.parse(r));
    },

    async get(project: string, iid: number) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/merge_requests/${iid}`);
      return MrSchema.parse(raw);
    },

    async create(project: string, body: {
      source_branch: string;
      target_branch: string;
      title: string;
      description?: string;
      remove_source_branch?: boolean;
      labels?: string;
      assignee_ids?: number[];
      reviewer_ids?: number[];
      milestone_id?: number;
    }) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/merge_requests`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return MrSchema.parse(raw);
    },

    async update(project: string, iid: number, body: {
      title?: string;
      description?: string;
      target_branch?: string;
      labels?: string;
      assignee_ids?: number[];
      reviewer_ids?: number[];
      milestone_id?: number;
      state_event?: "close" | "reopen";
    }) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/merge_requests/${iid}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      return MrSchema.parse(raw);
    },

    async merge(project: string, iid: number, options?: {
      merge_commit_message?: string;
      should_remove_source_branch?: boolean;
      squash?: boolean;
    }) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/merge_requests/${iid}/merge`, {
        method: "PUT",
        body: JSON.stringify(options ?? {}),
      });
      return MrSchema.parse(raw);
    },

    async delete(project: string, iid: number) {
      const id = await resolveId(project);
      await client.request(`/projects/${id}/merge_requests/${iid}`, { method: "DELETE" });
    },

    async diff(project: string, iid: number) {
      const id = await resolveId(project);
      const raw = await client.request<{ changes?: unknown[] }>(`/projects/${id}/merge_requests/${iid}/changes`);
      const changes = raw.changes ?? [];
      return changes.map((r) => MrDiffSchema.parse(r));
    },

    async approve(project: string, iid: number) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/merge_requests/${iid}/approve`, { method: "POST" });
      return MrApprovalsSchema.parse(raw);
    },

    async unapprove(project: string, iid: number) {
      const id = await resolveId(project);
      await client.request(`/projects/${id}/merge_requests/${iid}/unapprove`, { method: "POST" });
    },

    async approvals(project: string, iid: number) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/merge_requests/${iid}/approvals`);
      return MrApprovalsSchema.parse(raw);
    },

    async rebase(project: string, iid: number) {
      const id = await resolveId(project);
      await client.request(`/projects/${id}/merge_requests/${iid}/rebase`, { method: "POST" });
    },

    async pipelines(project: string, iid: number) {
      const id = await resolveId(project);
      const raw = await client.request<unknown[]>(`/projects/${id}/merge_requests/${iid}/pipelines`);
      return raw.map((r) => PipelineSchema.parse(r));
    },
  };
}
