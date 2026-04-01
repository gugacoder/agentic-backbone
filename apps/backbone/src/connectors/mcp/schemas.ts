import { z } from "zod";

export const credentialSchema = z.object({
  api_key: z
    .string()
    .optional()
    .describe("API key for HTTP MCP server (sent as Bearer token)"),
});

export const optionsSchema = z.object({
  transport: z.enum(["stdio", "http", "streamable-http"]).describe("Transport type: 'stdio', 'http' (legacy SSE), or 'streamable-http' (MCP 2024-11-05+)"),
  // stdio fields
  command: z
    .string()
    .optional()
    .describe("Command to spawn (required for stdio transport)"),
  args: z
    .array(z.string())
    .default([])
    .describe("Command-line arguments for the process"),
  env: z
    .record(z.string())
    .default({})
    .describe("Extra environment variables for the process"),
  // http fields
  url: z
    .string()
    .optional()
    .describe("URL of the HTTP/SSE MCP server (required for http transport)"),
  // common
  server_label: z
    .string()
    .default("MCP Server")
    .describe("Human-readable label for this MCP server"),
  allowed_tools: z
    .array(z.string())
    .default([])
    .describe("Whitelist of tool names to expose (empty = all tools)"),
});

export type McpCredential = z.infer<typeof credentialSchema>;
export type McpOptions = z.infer<typeof optionsSchema>;
