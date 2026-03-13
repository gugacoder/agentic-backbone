import type { GitLabClient } from "../client.js";
import { MrNoteSchema } from "../schemas/mr.js";

export function createMrNotesResource(client: GitLabClient) {
  async function resolveId(project: string) {
    return client.resolveProjectId(project);
  }

  return {
    async list(project: string, iid: number) {
      const id = await resolveId(project);
      const raw = await client.request<unknown[]>(`/projects/${id}/merge_requests/${iid}/notes`);
      return raw.map((r) => MrNoteSchema.parse(r));
    },

    async create(project: string, iid: number, body: string) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/merge_requests/${iid}/notes`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      return MrNoteSchema.parse(raw);
    },

    async update(project: string, iid: number, noteId: number, body: string) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/merge_requests/${iid}/notes/${noteId}`, {
        method: "PUT",
        body: JSON.stringify({ body }),
      });
      return MrNoteSchema.parse(raw);
    },

    async delete(project: string, iid: number, noteId: number) {
      const id = await resolveId(project);
      await client.request(`/projects/${id}/merge_requests/${iid}/notes/${noteId}`, { method: "DELETE" });
    },
  };
}
