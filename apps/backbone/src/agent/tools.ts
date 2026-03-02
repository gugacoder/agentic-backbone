import { createJobTools } from "../jobs/tools.js";
import { createMemoryAiTools } from "../memory/ai-tools.js";
import { createCronTools } from "../cron/tools.js";
import { createAdapterTools } from "../adapters/tools.js";
import { createMessageTools } from "../channels/tools.js";
import { createQueueTools } from "../conversations/queue-tools.js";

type AgentMode = "heartbeat" | "conversation" | "cron" | "memory";

interface ComposeOptions {
  sessionId?: string;
  userId?: string;
}

/**
 * Composes all available tools for an agent based on its operating mode.
 *
 * | Tool set        | heartbeat | conversation | cron | memory |
 * |-----------------|-----------|--------------|------|--------|
 * | job tools       | sim       | -            | -    | -      |
 * | memory tools    | -         | sim          | -    | -      |
 * | cron tools      | sim       | sim          | -    | -      |
 * | adapter tools   | sim       | sim          | sim  | -      |
 * | send_message    | sim       | sim          | sim  | -      |
 * | check_messages  | -         | sim          | -    | -      |
 */
export function composeAgentTools(
  agentId: string,
  mode: AgentMode,
  opts?: ComposeOptions
): Record<string, any> | undefined {
  const tools: Record<string, any> = {};

  // Job tools — heartbeat only
  if (mode === "heartbeat") {
    Object.assign(tools, createJobTools());
  }

  // Memory tools — conversation only
  if (mode === "conversation") {
    Object.assign(tools, createMemoryAiTools(agentId));
  }

  // Cron tools — heartbeat + conversation
  if (mode === "heartbeat" || mode === "conversation") {
    Object.assign(tools, createCronTools());
  }

  // Adapter tools — heartbeat + conversation + cron
  if (mode !== "memory") {
    const adapterTools = createAdapterTools(agentId);
    if (adapterTools) Object.assign(tools, adapterTools);
  }

  // Message tools — heartbeat + conversation + cron
  if (mode !== "memory") {
    const messageTools = createMessageTools(agentId, {
      sessionId: opts?.sessionId,
      recipientId: opts?.userId,
    });
    if (messageTools) Object.assign(tools, messageTools);
  }

  // Queue tools (check_messages) — conversation only, requires sessionId
  if (mode === "conversation" && opts?.sessionId) {
    Object.assign(tools, createQueueTools(opts.sessionId));
  }

  return Object.keys(tools).length > 0 ? tools : undefined;
}
