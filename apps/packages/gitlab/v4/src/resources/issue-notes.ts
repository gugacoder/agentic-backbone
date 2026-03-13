import type { GitLabClient } from "../client.js";
import { NoteSchema } from "../schemas/issue.js";

export function createIssueNotesResource(client: GitLabClient) {
  async function resolveId(project: string) {
    return client.resolveProjectId(project);
  }

  return {
    async list(project: string, iid: number, params?: { per_page?: number; sort?: "asc" | "desc" }) {
      const id = await resolveId(project);
      const qs = new URLSearchParams();
      if (params?.per_page) qs.set("per_page", String(params.per_page));
      if (params?.sort) qs.set("sort", params.sort);
      const raw = await client.request<unknown[]>(`/projects/${id}/issues/${iid}/notes?${qs}`);
      return raw.map((r) => NoteSchema.parse(r));
    },

    async create(project: string, iid: number, body: string) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/issues/${iid}/notes`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      return NoteSchema.parse(raw);
    },

    async update(project: string, iid: number, noteId: number, body: string) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/issues/${iid}/notes/${noteId}`, {
        method: "PUT",
        body: JSON.stringify({ body }),
      });
      return NoteSchema.parse(raw);
    },

    async delete(project: string, iid: number, noteId: number) {
      const id = await resolveId(project);
      await client.request(`/projects/${id}/issues/${iid}/notes/${noteId}`, { method: "DELETE" });
    },
  };
}
