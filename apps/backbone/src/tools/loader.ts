import { readYamlAs } from "../context/readers.js";
import { agentConfigPath } from "../context/paths.js";
import { AgentYmlSchema } from "../context/schemas.js";

export interface ToolApprovalConfig {
  name: string;
  approvalLabel: string;
  approvalTimeoutSeconds: number;
}

/**
 * Loads tool approval configs from the agent's AGENT.yml `tool-approvals` field.
 */
export function loadToolApprovalConfigs(
  agentId: string
): Map<string, ToolApprovalConfig> {
  const configs = new Map<string, ToolApprovalConfig>();

  try {
    const yml = readYamlAs(agentConfigPath(agentId), AgentYmlSchema);
    const approvals = yml["tool-approvals"];
    if (!approvals) return configs;

    for (const [toolName, entry] of Object.entries(approvals)) {
      configs.set(toolName, {
        name: toolName,
        approvalLabel: entry.label ?? toolName,
        approvalTimeoutSeconds: entry.timeout ?? 300,
      });
    }
  } catch {
    // Agent config not found or invalid — no approvals configured
  }

  return configs;
}
