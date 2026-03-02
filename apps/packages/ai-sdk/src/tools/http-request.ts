import { tool } from "ai";
import { z } from "zod";

const MAX_RESPONSE_SIZE = 50 * 1024; // 50KB
const MAX_TIMEOUT = 60_000;

export const httpRequestTool = tool({
  description:
    "Sends an HTTP request to a URL. Supports all methods, custom headers, and JSON/text bodies. Use for REST API interactions.",
  inputSchema: z.object({
    method: z
      .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
      .describe("HTTP method"),
    url: z.string().url().describe("Target URL"),
    headers: z
      .record(z.string())
      .optional()
      .describe("Custom headers (e.g. Authorization, Content-Type)"),
    body: z
      .string()
      .optional()
      .describe("Request body (JSON string or plain text)"),
    timeout: z
      .number()
      .optional()
      .default(30_000)
      .describe("Timeout in ms (max 60000)"),
  }),
  execute: async ({ method, url, headers, body, timeout }) => {
    const effectiveTimeout = Math.min(timeout ?? 30_000, MAX_TIMEOUT);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), effectiveTimeout);

    try {
      const fetchHeaders: Record<string, string> = { ...headers };

      // Auto-set Content-Type for JSON bodies if not specified
      if (body && !fetchHeaders["Content-Type"] && !fetchHeaders["content-type"]) {
        try {
          JSON.parse(body);
          fetchHeaders["Content-Type"] = "application/json";
        } catch {
          // Not JSON — leave Content-Type unset
        }
      }

      const response = await fetch(url, {
        method,
        headers: fetchHeaders,
        body: method !== "GET" && method !== "HEAD" ? body : undefined,
        signal: controller.signal,
      });

      // Collect response headers (subset)
      const responseHeaders: Record<string, string> = {};
      for (const key of ["content-type", "location", "x-request-id", "retry-after"]) {
        const val = response.headers.get(key);
        if (val) responseHeaders[key] = val;
      }

      // Read response body
      const contentType = response.headers.get("content-type") ?? "";
      let responseBody: unknown;

      if (method === "HEAD") {
        responseBody = null;
      } else {
        const text = await response.text();
        const truncated = text.length > MAX_RESPONSE_SIZE;
        const bodyText = truncated ? text.slice(0, MAX_RESPONSE_SIZE) : text;

        // Try JSON parse if content-type indicates JSON
        if (contentType.includes("json")) {
          try {
            responseBody = JSON.parse(bodyText);
          } catch {
            responseBody = bodyText;
          }
        } else {
          responseBody = bodyText;
        }

        if (truncated) {
          responseHeaders["x-truncated"] = `true (${text.length} bytes, showing first ${MAX_RESPONSE_SIZE})`;
        }
      }

      return JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
      });
    } catch (err: any) {
      if (err.name === "AbortError") {
        return `Error: Request timed out after ${effectiveTimeout}ms`;
      }
      return `Error: ${err.message}`;
    } finally {
      clearTimeout(timer);
    }
  },
});
