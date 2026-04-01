/**
 * MCP Server factory.
 *
 * Creates and configures an McpServer instance with all backbone tools.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMcpTools } from "./tools.js";
import type { McpServerConfig } from "../settings/mcp-server.js";

export function createBackboneMcpServer(config: McpServerConfig): McpServer {
  const server = new McpServer(
    {
      name: "agentic-backbone",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  registerMcpTools(server, config);

  return server;
}
