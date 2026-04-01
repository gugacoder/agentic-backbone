import type { GitLabClient } from "../client.js";
import { CompareResultSchema } from "../schemas/repo.js";

export function createRepoCompareResource(client: GitLabClient) {
  return {
    async compare(project: string, from: string, to: string, straight?: boolean) {
      const id = await client.resolveProjectId(project);
      const qs = new URLSearchParams({ from, to });
      if (straight !== undefined) qs.set("straight", String(straight));
      const raw = await client.request<unknown>(`/projects/${id}/repository/compare?${qs}`);
      return CompareResultSchema.parse(raw);
    },
  };
}
