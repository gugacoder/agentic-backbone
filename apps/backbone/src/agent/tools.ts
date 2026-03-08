import { createJobTools } from "../jobs/tools/index.js";
import { createMemoryAiTools } from "../memory/tools/index.js";
import { createCronTools } from "../cron/tools/index.js";
import { createMessageTools } from "../channels/tools/index.js";
import { createEmitTool, createSysinfoTool } from "../tools/tools/index.js";
import { connectorRegistry } from "../connectors/index.js";
import { loadToolApprovalConfigs } from "../tools/loader.js";
import { withApprovalGate } from "../tools/approval-interceptor.js";
import { getQuotas, recordToolCall } from "../quotas/quota-manager.js";

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

  // Wrap tools that have requires_approval: true in their TOOL.md
  const approvalConfigs = loadToolApprovalConfigs(agentId);
  if (approvalConfigs.size > 0) {
    for (const [toolName, config] of approvalConfigs) {
      const toolDef = tools[toolName];
      if (!toolDef || typeof toolDef.execute !== "function") continue;
      const originalExecute = toolDef.execute as (args: unknown) => Promise<unknown>;
      toolDef.execute = (args: unknown) =>
        withApprovalGate(
          agentId,
          toolName,
          config,
          opts?.sessionId,
          args,
          () => originalExecute(args)
        );
    }
  }

  // Wrap all tool executes with timeout from quota config
  const quotas = getQuotas(agentId);
  const timeoutMs = quotas.maxToolTimeoutMs ?? 30000;
  for (const [toolName, toolDef] of Object.entries(tools)) {
    if (!toolDef || typeof toolDef.execute !== "function") continue;
    const originalExecute = toolDef.execute as (args: unknown, ctx?: unknown) => Promise<unknown>;
    toolDef.execute = async (args: unknown, ctx?: unknown) => {
      recordToolCall(agentId);
      const signal = AbortSignal.timeout(timeoutMs);
      try {
        const result = await Promise.race([
          originalExecute(args, ctx),
          new Promise<never>((_, reject) =>
            signal.addEventListener("abort", () =>
              reject(new Error(`tool_timeout:${timeoutMs}`))
            )
          ),
        ]);
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.startsWith("tool_timeout:")) {
          console.warn(`[tools] ${toolName} timed out after ${timeoutMs}ms for agent ${agentId}`);
          return { error: "timeout", ms: timeoutMs };
        }
        throw err;
      }
    };
  }

  return Object.keys(tools).length > 0 ? tools : undefined;
}
