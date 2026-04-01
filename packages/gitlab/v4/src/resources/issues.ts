import { z } from "zod";
import type { GitLabClient } from "../client.js";
import { IssueSchema, IssueLinkSchema, NoteSchema } from "../schemas/issue.js";
import { MrSchema } from "../schemas/mr.js";

export function createIssuesResource(client: GitLabClient) {
  async function resolveId(project: string) {
    return client.resolveProjectId(project);
  }

  return {
    async list(project: string, params?: {
      state?: "opened" | "closed" | "all";
      labels?: string;
      assignee_username?: string;
      milestone?: string;
      per_page?: number;
    }) {
      const id = await resolveId(project);
      const qs = new URLSearchParams();
      if (params?.state) qs.set("state", params.state);
      if (params?.labels) qs.set("labels", params.labels);
      if (params?.assignee_username) qs.set("assignee_username", params.assignee_username);
      if (params?.milestone) qs.set("milestone", params.milestone);
      if (params?.per_page) qs.set("per_page", String(params.per_page));
      const raw = await client.request<unknown[]>(`/projects/${id}/issues?${qs}`);
      return raw.map((r) => IssueSchema.parse(r));
    },

    async get(project: string, iid: number) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/issues/${iid}`);
      return IssueSchema.parse(raw);
    },

    async create(project: string, body: {
      title: string;
      description?: string;
      labels?: string;
      assignee_ids?: number[];
      milestone_id?: number;
      due_date?: string;
    }) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/issues`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return IssueSchema.parse(raw);
    },

    async update(project: string, iid: number, body: {
      title?: string;
      description?: string;
      labels?: string;
      assignee_ids?: number[];
      milestone_id?: number;
      due_date?: string;
      state_event?: "close" | "reopen";
    }) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/issues/${iid}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      return IssueSchema.parse(raw);
    },

    async delete(project: string, iid: number) {
      const id = await resolveId(project);
      await client.request(`/projects/${id}/issues/${iid}`, { method: "DELETE" });
    },

    async move(project: string, iid: number, to_project_id: number) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/issues/${iid}/move`, {
        method: "POST",
        body: JSON.stringify({ to_project_id }),
      });
      return IssueSchema.parse(raw);
    },

    async listLinks(project: string, iid: number) {
      const id = await resolveId(project);
      const raw = await client.request<unknown[]>(`/projects/${id}/issues/${iid}/links`);
      return raw.map((r) => IssueLinkSchema.parse(r));
    },

    async addLink(
      project: string,
      iid: number,
      target_project_id: number,
      target_issue_iid: number,
      link_type?: "relates_to" | "blocks" | "is_blocked_by",
    ) {
      const id = await resolveId(project);
      const body: Record<string, unknown> = { target_project_id, target_issue_iid };
      if (link_type) body.link_type = link_type;
      const raw = await client.request<unknown>(`/projects/${id}/issues/${iid}/links`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return IssueLinkSchema.parse(raw);
    },

    async relatedMrs(project: string, iid: number) {
      const id = await resolveId(project);
      const raw = await client.request<unknown[]>(`/projects/${id}/issues/${iid}/related_merge_requests`);
      return raw.map((r) => MrSchema.parse(r));
    },
  };
}
