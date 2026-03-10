import type { AgentEvent } from "../types.js";
import type { ToolDefinition } from "../tool-defs.js";

export interface AgentProviderOptions {
  sdkSessionId?: string;
  role?: string;
  tools?: ToolDefinition[];
  mcpServers?: Record<string, unknown>;
  maxTurns?: number;
}

export interface AgentProvider {
  run(
    prompt: string,
    options?: AgentProviderOptions
  ): AsyncGenerator<AgentEvent>;
}
