import { tool } from "ai";
import { z } from "zod";

const MAX_SPEC_SIZE = 512 * 1024; // 512KB

interface EndpointInfo {
  method: string;
  path: string;
  summary?: string;
  parameters?: Array<{ name: string; in: string; required?: boolean; type?: string }>;
  requestBody?: string;
  responses?: Record<string, string>;
}

interface SpecSummary {
  title: string;
  version: string;
  baseUrl: string;
  auth: string[];
  endpoints: EndpointInfo[];
}

function extractEndpoints(spec: any): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const paths = spec.paths ?? {};

  for (const [path, methods] of Object.entries(paths)) {
    if (typeof methods !== "object" || methods === null) continue;

    for (const [method, op] of Object.entries(methods as Record<string, any>)) {
      if (["get", "post", "put", "patch", "delete", "head", "options"].indexOf(method) === -1) continue;

      const endpoint: EndpointInfo = {
        method: method.toUpperCase(),
        path,
        summary: op.summary ?? op.description?.slice(0, 120),
      };

      // Parameters
      if (Array.isArray(op.parameters) && op.parameters.length > 0) {
        endpoint.parameters = op.parameters.map((p: any) => ({
          name: p.name,
          in: p.in,
          required: p.required,
          type: p.schema?.type ?? p.type,
        }));
      }

      // Request body
      if (op.requestBody) {
        const content = op.requestBody.content;
        if (content) {
          const mediaType = Object.keys(content)[0];
          endpoint.requestBody = mediaType;
        }
      }

      // Responses
      if (op.responses) {
        endpoint.responses = {};
        for (const [code, resp] of Object.entries(op.responses as Record<string, any>)) {
          endpoint.responses[code] = resp.description?.slice(0, 80) ?? "";
        }
      }

      endpoints.push(endpoint);
    }
  }

  return endpoints;
}

function extractAuth(spec: any): string[] {
  const auth: string[] = [];
  const schemes = spec.components?.securitySchemes ?? spec.securityDefinitions ?? {};

  for (const [name, scheme] of Object.entries(schemes as Record<string, any>)) {
    const type = scheme.type ?? "unknown";
    const loc = scheme.in ? ` (in ${scheme.in})` : "";
    const flow = scheme.flows ? ` [${Object.keys(scheme.flows).join(", ")}]` : "";
    auth.push(`${name}: ${type}${loc}${flow}`);
  }

  return auth;
}

function extractBaseUrl(spec: any): string {
  // OpenAPI 3.x
  if (Array.isArray(spec.servers) && spec.servers.length > 0) {
    return spec.servers[0].url;
  }
  // Swagger 2.x
  if (spec.host) {
    const scheme = spec.schemes?.[0] ?? "https";
    const basePath = spec.basePath ?? "";
    return `${scheme}://${spec.host}${basePath}`;
  }
  return "unknown";
}

export const apiSpecTool = tool({
  description:
    "Fetches and parses an API specification (OpenAPI/Swagger JSON or YAML). Returns a structured summary of available endpoints, methods, parameters, and authentication requirements.",
  inputSchema: z.object({
    url: z
      .string()
      .describe("URL to the OpenAPI/Swagger spec (JSON or YAML)"),
    format: z
      .enum(["openapi", "auto"])
      .optional()
      .default("auto")
      .describe("Spec format (default: auto-detect)"),
  }),
  execute: async ({ url }) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json, application/yaml, text/yaml, */*" },
      });
      clearTimeout(timer);

      if (!response.ok) {
        return `Error: HTTP ${response.status} ${response.statusText}`;
      }

      const text = await response.text();
      if (text.length > MAX_SPEC_SIZE) {
        return `Error: Spec too large (${text.length} bytes, max ${MAX_SPEC_SIZE})`;
      }

      // Parse JSON (YAML support would require a dependency — JSON covers most use cases)
      let spec: any;
      try {
        spec = JSON.parse(text);
      } catch {
        return "Error: Could not parse spec as JSON. Provide a JSON-format OpenAPI/Swagger spec URL.";
      }

      const summary: SpecSummary = {
        title: spec.info?.title ?? "Untitled API",
        version: spec.info?.version ?? "unknown",
        baseUrl: extractBaseUrl(spec),
        auth: extractAuth(spec),
        endpoints: extractEndpoints(spec),
      };

      return JSON.stringify(summary, null, 2);
    } catch (err: any) {
      if (err.name === "AbortError") {
        return "Error: Request timed out after 30s";
      }
      return `Error: ${err.message}`;
    }
  },
});
