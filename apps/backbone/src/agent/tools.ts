import { createJobTools } from "../jobs/tools.js";
import { createMemoryAiTools } from "../memory/ai-tools.js";
import { createCronTools } from "../cron/tools.js";
import { createAdapterTools } from "../adapters/tools.js";
import { createMessageTools } from "../channels/tools.js";

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

  const adapterTools = createAdapterTools(agentId);
  if (adapterTools) Object.assign(tools, adapterTools);

  const messageTools = createMessageTools(agentId, {
    recipientId: opts?.userId,
  });
  if (messageTools) Object.assign(tools, messageTools);

  return Object.keys(tools).length > 0 ? tools : undefined;
}
