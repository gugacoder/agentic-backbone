import type { GitLabClient } from "../client.js";
import { UserSchema } from "../schemas/user.js";

export function createUsersResource(client: GitLabClient) {
  return {
    async me() {
      const raw = await client.request<unknown>("/user");
      return UserSchema.parse(raw);
    },

    async search(query: string, params?: { per_page?: number }) {
      const qs = new URLSearchParams({ search: query });
      if (params?.per_page) qs.set("per_page", String(params.per_page));
      const raw = await client.request<unknown[]>(`/users?${qs}`);
      return raw.map((r) => UserSchema.parse(r));
    },

    async get(userId: number) {
      const raw = await client.request<unknown>(`/users/${userId}`);
      return UserSchema.parse(raw);
    },
  };
}
