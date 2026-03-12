import { tool } from "ai";
import { z } from "zod";
import { connectorRegistry } from "../../index.js";
import type { HttpClient } from "../client.js";

export function createHttpRequestTool(adapters: { slug: string; policy: string }[]) {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const policyMap = new Map(adapters.map((a) => [a.slug, a.policy]));

  return {
    http_request: tool({
      description: "Faz uma requisição HTTP para um adapter configurado. Suporta GET, POST, PUT, PATCH, DELETE.",
      parameters: z.object({
        adapter: z.enum(slugs).describe("Slug do adapter HTTP a usar"),
        method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).describe("Método HTTP"),
        path: z.string().describe("Caminho da URL relativo ao baseUrl do adapter (ex: /v1/forecast)"),
        params: z.record(z.string()).optional().describe("Query params a adicionar na URL"),
        body: z.unknown().optional().describe("Corpo da requisição (para POST/PUT/PATCH)"),
        headers: z.record(z.string()).optional().describe("Headers adicionais"),
      }),
      execute: async ({ adapter: adapterSlug, method, path, params, body, headers }) => {
        const policy = policyMap.get(adapterSlug);
        if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && policy === "readonly") {
          throw new Error(`Adapter "${adapterSlug}" é readonly — método ${method} não permitido`);
        }

        const client = connectorRegistry.createClient(adapterSlug) as HttpClient;

        let resolvedPath = path;
        if (params && Object.keys(params).length > 0) {
          const qs = new URLSearchParams(params).toString();
          resolvedPath = `${path}${path.includes("?") ? "&" : "?"}${qs}`;
        }

        return client.request(method, resolvedPath, body, headers);
      },
    }),
  };
}
