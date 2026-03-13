import type { GitLabClient } from "../client.js";
import { FileContentSchema } from "../schemas/repo.js";

export function createRepoFilesResource(client: GitLabClient) {
  async function resolveId(project: string) {
    return client.resolveProjectId(project);
  }

  return {
    async get(project: string, filePath: string, ref: string) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(
        `/projects/${id}/repository/files/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(ref)}`,
      );
      return FileContentSchema.parse(raw);
    },

    async create(project: string, filePath: string, body: {
      branch: string;
      content: string;
      commit_message: string;
      author_name?: string;
      author_email?: string;
    }) {
      const id = await resolveId(project);
      const raw = await client.request<{ file_path: string; branch: string }>(
        `/projects/${id}/repository/files/${encodeURIComponent(filePath)}`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      return raw;
    },

    async update(project: string, filePath: string, body: {
      branch: string;
      content: string;
      commit_message: string;
      last_commit_id?: string;
      author_name?: string;
      author_email?: string;
    }) {
      const id = await resolveId(project);
      const raw = await client.request<{ file_path: string; branch: string }>(
        `/projects/${id}/repository/files/${encodeURIComponent(filePath)}`,
        {
          method: "PUT",
          body: JSON.stringify(body),
        },
      );
      return raw;
    },

    async delete(project: string, filePath: string, body: {
      branch: string;
      commit_message: string;
      author_name?: string;
      author_email?: string;
    }) {
      const id = await resolveId(project);
      await client.request(
        `/projects/${id}/repository/files/${encodeURIComponent(filePath)}`,
        {
          method: "DELETE",
          body: JSON.stringify(body),
        },
      );
    },
  };
}
