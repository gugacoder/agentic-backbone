import { createJobTools } from "../jobs/tools/index.js";
import { createMemoryAiTools } from "../memory/tools/index.js";
import { createCronTools } from "../cron/tools/index.js";
import { createMessageTools } from "../channels/tools/index.js";
import { createEmitTool, createSysinfoTool } from "../tools/tools/index.js";
import { connectorRegistry } from "../connectors/index.js";

type AgentMode = "heartbeat" | "conversation" | "cron" | "memory";

interface ComposeOptions {
  sessionId?: string;
  userId?: string;
}

/**
 * Composes all available tools for an agent run.
 * The agent is one — all tools are available in all modes.
 */
export function composeAgentTools(
  agentId: string,
  _mode?: AgentMode,
  opts?: ComposeOptions
): Record<string, any> | undefined {
  const tools: Record<string, any> = {};

  Object.assign(tools, createJobTools());
  Object.assign(tools, createMemoryAiTools(agentId));
  Object.assign(tools, createCronTools());

  const connectorTools = connectorRegistry.composeTools(agentId);
  if (connectorTools) Object.assign(tools, connectorTools);

  const messageTools = createMessageTools(agentId, {
    recipientId: opts?.userId,
  });
  if (messageTools) Object.assign(tools, messageTools);

  Object.assign(tools, createEmitTool(agentId));
  Object.assign(tools, createSysinfoTool());

  return Object.keys(tools).length > 0 ? tools : undefined;
}
