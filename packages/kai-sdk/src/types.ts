export type KaiAgentEvent =
  | { type: "init"; sessionId: string }
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
}
