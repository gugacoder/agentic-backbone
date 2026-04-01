import type { GitLabClient } from "../client.js";
import { WikiPageSchema } from "../schemas/wiki.js";

export function createWikiResource(client: GitLabClient) {
  async function resolveId(project: string) {
    return client.resolveProjectId(project);
  }

  return {
    async list(project: string) {
      const id = await resolveId(project);
      const raw = await client.request<unknown[]>(`/projects/${id}/wikis`);
      return raw.map((r) => WikiPageSchema.parse(r));
    },

    async get(project: string, slug: string) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/wikis/${encodeURIComponent(slug)}`);
      return WikiPageSchema.parse(raw);
    },

    async create(project: string, body: {
      title: string;
      content: string;
      format?: "markdown" | "rdoc" | "asciidoc";
    }) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/wikis`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return WikiPageSchema.parse(raw);
    },

    async update(project: string, slug: string, body: {
      title?: string;
      content?: string;
      format?: "markdown" | "rdoc" | "asciidoc";
    }) {
      const id = await resolveId(project);
      const raw = await client.request<unknown>(`/projects/${id}/wikis/${encodeURIComponent(slug)}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      return WikiPageSchema.parse(raw);
    },

    async delete(project: string, slug: string) {
      const id = await resolveId(project);
      await client.request(`/projects/${id}/wikis/${encodeURIComponent(slug)}`, { method: "DELETE" });
    },
  };
}
