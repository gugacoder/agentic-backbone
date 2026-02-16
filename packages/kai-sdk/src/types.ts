export interface McpServerConfig {
  name: string;
  transport:
    | { type: "http"; url: string; headers?: Record<string, string> }
    | { type: "stdio"; command: string; args?: string[] };
}

export type KaiAgentEvent =
  | { type: "init"; sessionId: string }
  | { type: "mcp_connected"; servers: string[] }
  | { type: "text"; content: string }
  | { type: "result"; content: string }
  | { type: "usage"; usage: KaiUsageData }
  | { type: "ask_user"; question: string; options?: string[] }
  | { type: "todo_update"; todos: KaiTodoItem[] };

export interface KaiTodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  priority: "high" | "medium" | "low";
}

export interface KaiUsageData {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  totalCostUsd: number;
  numTurns: number;
  durationMs: number;
  durationApiMs: number;
  stopReason: string;
}

export interface KaiAgentOptions {
  model: string;
  apiKey: string;
  sessionId?: string;
  sessionDir?: string;
  maxSteps?: number;
  system?: string;
  /** Callback invoked when the agent uses the AskUser tool. Return the user's answer. */
  onAskUser?: (question: string, options?: string[]) => Promise<string>;
  /** Callback invoked when the agent uses the WebSearch tool. Return search results. */
  onWebSearch?: (query: string, numResults: number) => Promise<Array<{ title: string; url: string; snippet: string }>>;
  /** Callback invoked when the agent uses the CodeSearch tool. Return code examples and documentation. */
  onCodeSearch?: (query: string) => Promise<Array<{ title: string; url: string; content: string }>>;
  /** MCP servers to connect to. Tools from these servers are merged with codingTools. */
  mcpServers?: McpServerConfig[];
  /** Extra Vercel AI SDK tools to merge. Useful for in-process tools that aren't MCP servers. */
  tools?: Record<string, any>;
  /** Override context window size (tokens) for the model. Takes precedence over the built-in model map. */
  contextWindow?: number;
}
