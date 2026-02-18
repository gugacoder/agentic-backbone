import type { AgentEvent } from "../types.js";

export interface AgentProviderOptions {
  sdkSessionId?: string;
  role?: string;
  mcpServers?: Record<string, unknown>;
  maxTurns?: number;
  tools?: Record<string, any>;
}

export interface AgentProvider {
  run(
    prompt: string,
    options?: AgentProviderOptions
  ): AsyncGenerator<AgentEvent>;
}
