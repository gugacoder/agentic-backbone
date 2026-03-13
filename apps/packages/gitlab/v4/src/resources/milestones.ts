import type { GitLabClient } from "../client.js";
import { MilestoneSchema } from "../schemas/milestone.js";
import { IssueSchema } from "../schemas/issue.js";
import { MrSchema } from "../schemas/mr.js";

export function createMilestonesResource(client: GitLabClient) {
  async function resolveId(project: string) {
    return client.resolveProjectId(project);
  }

  return {
    async list(project: string, params?: { state?: "active" | "closed"; per_page?: number }) {
      const id = await resolveId(project);
      const qs = new URLSearchParams();
      if (params?.state) qs.set("state", params.state);
      if (params?.per_page) qs.set("per_page", String(params.per_page));
      const raw = await client.request<unknown[]>(`/projects/${id}/milestones?${qs}`);
      return raw.map((r) => MilestoneSchema.parse(r));
    },

    async get(project: string, milestoneId: number) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/milestones/${milestoneId}`);
      return MilestoneSchema.parse(raw);
    },

    async create(project: string, body: {
      title: string;
      description?: string;
      due_date?: string;
      start_date?: string;
    }) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/milestones`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return MilestoneSchema.parse(raw);
    },

    async update(project: string, milestoneId: number, body: {
      title?: string;
      description?: string;
      due_date?: string;
      start_date?: string;
      state_event?: "activate" | "close";
    }) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/milestones/${milestoneId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      return MilestoneSchema.parse(raw);
    },

    async delete(project: string, milestoneId: number) {
      const id = await resolveId(project);
      await client.request(`/projects/${id}/milestones/${milestoneId}`, { method: "DELETE" });
    },

    async issues(project: string, milestoneId: number) {
      const id = await resolveId(project);
      const raw = await client.request<unknown[]>(`/projects/${id}/milestones/${milestoneId}/issues`);
      return raw.map((r) => IssueSchema.parse(r));
    },

    async mrs(project: string, milestoneId: number) {
      const id = await resolveId(project);
      const raw = await client.request<unknown[]>(`/projects/${id}/milestones/${milestoneId}/merge_requests`);
      return raw.map((r) => MrSchema.parse(r));
    },
  };
}
