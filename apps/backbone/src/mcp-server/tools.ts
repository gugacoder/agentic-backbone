/**
 * MCP Server tool implementations.
 *
 * Tools exposed to external MCP clients (Claude Desktop, Cursor, etc.):
 * - list_agents
 * - send_message
 * - get_agent_status
 * - get_agent_memory
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { listAgents, getAgent } from "../agents/registry.js";
import {
  createSession,
  sendMessage,
} from "../conversations/index.js";
import { getHeartbeatStatus } from "../heartbeat/index.js";
import { getAgentMemoryManager } from "../memory/manager.js";
import type { McpServerConfig } from "../settings/mcp-server.js";

/**
 * Registers all backbone tools on the given McpServer instance.
 * Filters agents based on `config.allowed_agents` (empty = all).
 */
export function registerMcpTools(server: McpServer, config: McpServerConfig): void {
  // ---------------------------------------------------------------------------
  // list_agents
  // ---------------------------------------------------------------------------
  server.tool(
    "list_agents",
    "Lista os agentes ativos do backbone",
    {},
    async () => {
      const all = listAgents();
      const agents = all
        .filter((a) => a.enabled)
        .filter(
          (a) =>
            config.allowed_agents.length === 0 ||
            config.allowed_agents.includes(a.id)
        )
        .map((a) => ({
          id: a.id,
          label: a.metadata?.label ?? a.id,
          enabled: a.enabled,
          heartbeat: a.heartbeat.enabled,
          description: a.description ?? "",
        }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ agents }, null, 2),
          },
        ],
      };
    }
  );

  // ---------------------------------------------------------------------------
  // send_message
  // ---------------------------------------------------------------------------
  const sendMessageSchema = {
    agentId: z.string().describe("ID do agente (ex: system.main)"),
    message: z.string().describe("Mensagem a enviar"),
    sessionId: z.string().describe("ID de sessão existente (use string vazia para criar nova sessão)"),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.tool(
    "send_message",
    "Envia uma mensagem para um agente e retorna a resposta",
    sendMessageSchema as any,
    async ({ agentId, message, sessionId }: { agentId: string; message: string; sessionId: string }): Promise<CallToolResult> => {
      // Verify agent exists and is accessible
      const agent = getAgent(agentId);
      if (!agent) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: `Agente '${agentId}' não encontrado` }) },
          ],
          isError: true,
        };
      }

      if (!agent.enabled) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: `Agente '${agentId}' está desabilitado` }) },
          ],
          isError: true,
        };
      }

      // Respect allowed_agents filter
      if (
        config.allowed_agents.length > 0 &&
        !config.allowed_agents.includes(agentId)
      ) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: `Agente '${agentId}' não está acessível via MCP` }) },
          ],
          isError: true,
        };
      }

      // Create or reuse session
      const MCP_USER = "mcp-client";
      let activeSessionId = sessionId || "";
      if (!activeSessionId) {
        const session = createSession(MCP_USER, agentId);
        activeSessionId = session.session_id;
      }

      // Collect the full response text
      let responseText = "";
      try {
        for await (const event of sendMessage(MCP_USER, activeSessionId, message)) {
          if (event.type === "result") {
            responseText = event.content;
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: errMsg }) },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ response: responseText, sessionId: activeSessionId }),
          },
        ],
      };
    }
  );

  // ---------------------------------------------------------------------------
  // get_agent_status
  // ---------------------------------------------------------------------------
  server.tool(
    "get_agent_status",
    "Retorna o status atual de um agente",
    { agentId: z.string().describe("ID do agente") } as any,
    async ({ agentId }: { agentId: string }) => {
      const agent = getAgent(agentId);
      if (!agent) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: `Agente '${agentId}' não encontrado` }) },
          ],
          isError: true,
        };
      }

      if (
        config.allowed_agents.length > 0 &&
        !config.allowed_agents.includes(agentId)
      ) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: `Agente '${agentId}' não está acessível via MCP` }) },
          ],
          isError: true,
        };
      }

      const heartbeatStatuses = getHeartbeatStatus();
      const hbState = heartbeatStatuses[agentId];

      const status = {
        agentId,
        enabled: agent.enabled,
        heartbeat: {
          enabled: agent.heartbeat.enabled,
          running: hbState?.running ?? false,
          lastStatus: hbState?.lastStatus ?? null,
          lastSentAt: hbState?.lastSentAt ?? null,
        },
      };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(status, null, 2) },
        ],
      };
    }
  );

  // ---------------------------------------------------------------------------
  // get_agent_memory
  // ---------------------------------------------------------------------------
  server.tool(
    "get_agent_memory",
    "Busca na memória semântica de um agente",
    {
      agentId: z.string().describe("ID do agente"),
      query: z.string().describe("Texto para busca semântica"),
    } as any,
    async ({ agentId, query }: { agentId: string; query: string }) => {
      const agent = getAgent(agentId);
      if (!agent) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: `Agente '${agentId}' não encontrado` }) },
          ],
          isError: true,
        };
      }

      if (
        config.allowed_agents.length > 0 &&
        !config.allowed_agents.includes(agentId)
      ) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: `Agente '${agentId}' não está acessível via MCP` }) },
          ],
          isError: true,
        };
      }

      try {
        const mgr = getAgentMemoryManager(agentId);
        const results = await mgr.search(query, { maxResults: 10 });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                results: results.map((r) => ({
                  content: r.snippet,
                  score: r.score,
                  source: r.path,
                })),
              }, null, 2),
            },
          ],
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: errMsg }) },
          ],
          isError: true,
        };
      }
    }
  );
}
