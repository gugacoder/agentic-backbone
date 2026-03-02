import { createJobTools } from "../jobs/tools.js";
import { createMemoryAiTools } from "../memory/ai-tools.js";
import { createCronTools } from "../cron/tools.js";
import { createAdapterTools } from "../adapters/tools.js";
import { createMessageTools } from "../channels/tools.js";

type AgentMode = "heartbeat" | "conversation" | "cron" | "memory";

/**
 * Composes all available tools for an agent based on its operating mode.
 *
 * | Tool set       | heartbeat | conversation | cron | memory |
 * |----------------|-----------|--------------|------|--------|
 * | job tools      | sim       | -            | -    | -      |
 * | memory tools   | -         | sim          | -    | -      |
 * | cron tools     | sim       | sim          | -    | -      |
 * | adapter tools  | sim       | sim          | sim  | -      |
 * | send_message   | sim       | sim          | sim  | -      |
 */
export function composeAgentTools(
  agentId: string,
  mode: AgentMode
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
    const messageTools = createMessageTools(agentId);
    if (messageTools) Object.assign(tools, messageTools);
  }

  return Object.keys(tools).length > 0 ? tools : undefined;
}
