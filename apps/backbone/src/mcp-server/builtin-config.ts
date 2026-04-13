/**
 * Builds the MCP server config for the builtin backbone tools.
 *
 * Returns a stdio MCP server config that the CLI will spawn as a child process.
 * The spawned process calls back to the backbone via HTTP.
 */

import { join } from "node:path";
import { existsSync } from "node:fs";

const BUILTIN_SCRIPT = join(import.meta.dirname, "builtin.js");

interface StdioMcpServerConfig {
  type: "stdio";
  command: string;
  args: string[];
  env: Record<string, string>;
}

export function buildBuiltinMcpConfig(agentId: string): StdioMcpServerConfig | null {
  // Resolve the compiled builtin script path
  const scriptPath = existsSync(BUILTIN_SCRIPT)
    ? BUILTIN_SCRIPT
    : join(import.meta.dirname, "builtin.mjs");

  if (!existsSync(scriptPath)) {
    console.warn("[mcp-builtin] builtin script not found:", scriptPath);
    return null;
  }

  const port = process.env.BACKBONE_PORT;
  if (!port) {
    console.warn("[mcp-builtin] BACKBONE_PORT not set, cannot build builtin MCP config");
    return null;
  }

  // Generate a JWT token for the builtin server
  const token = process.env._BACKBONE_SYSTEM_TOKEN;
  if (!token) {
    console.warn("[mcp-builtin] _BACKBONE_SYSTEM_TOKEN not set");
    return null;
  }

  return {
    type: "stdio",
    command: "node",
    args: [scriptPath],
    env: {
      BACKBONE_URL: `http://localhost:${port}/api/v1/ai`,
      BACKBONE_TOKEN: token,
      AGENT_ID: agentId,
    },
  };
}
