import type { LanguageModelMiddleware } from "ai";

export interface McpServerConfig {
  name: string;
  transport:
    | { type: "http"; url: string; headers?: Record<string, string> }
    | { type: "stdio"; command: string; args?: string[] };
}

export interface ToolApprovalRequest {
  /** Nome da tool que precisa de aprovação */
  toolName: string;
  /** Parâmetros que o modelo quer passar para a tool */
  params: Record<string, unknown>;
}

export type AiAgentEvent =
  | { type: "init"; sessionId: string }
  | { type: "mcp_connected"; servers: string[] }
  | { type: "text"; content: string }
  | { type: "result"; content: string }
  | { type: "usage"; usage: AiUsageData }
  | { type: "ask_user"; question: string; options?: string[] }
  | { type: "todo_update"; todos: AiTodoItem[] }
  | { type: "context_status"; context: ContextUsage & { compacted: boolean } }
  | { type: "step_finish"; step: number; toolCalls: string[]; finishReason: string }
  | { type: "tool_approval"; toolName: string; params: Record<string, unknown>; approved: boolean }
  | { type: "tool_repair"; toolName: string; error: string; repaired: boolean }
  | { type: "mcp_error"; server: string; error: string };

export interface AiTodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  priority: "high" | "medium" | "low";
}

export interface AiUsageData {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  totalCostUsd: number;
  numTurns: number;
  durationMs: number;
  durationApiMs: number;
  stopReason: string;
  /** Latencia ate o primeiro token (ms). Disponivel apenas com telemetria. */
  timeToFirstTokenMs?: number;
  /** Numero de tool calls reparadas nesta sessao. */
  repairedToolCalls?: number;
  /** Breakdown de uso por step. Disponivel apenas com telemetria. */
  steps?: Array<{
    stepNumber: number;
    toolCalls: string[];
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
  }>;
}

export interface ContextUsage {
  model: string;
  contextWindow: number;
  systemPrompt: number;
  toolDefinitions: number;
  messages: number;
  used: number;
  free: number;
  usagePercent: number;
  compactThreshold: number;
  willCompact: boolean;
}

export interface PrepareStepContext {
  /** Current step number (0-indexed) */
  stepNumber: number;
  /** Total number of steps executed so far */
  stepCount: number;
  /** Tool calls from the previous step (empty on first step) */
  previousToolCalls: string[];
}

export interface PrepareStepResult {
  /** Switch model for this step */
  model?: string;
  /** Filter available tools for this step (tool names) */
  activeTools?: string[];
  /** Force tool choice: "auto" | "required" | "none" | specific tool */
  toolChoice?: "auto" | "required" | "none" | { type: "tool"; toolName: string };
}

export interface AiTelemetryOptions {
  /** Habilita tracing OpenTelemetry. Default: false */
  enabled: boolean;
  /** Identificador da funcao nos spans (ex: "ai-agent", "heartbeat") */
  functionId?: string;
  /** Metadata adicional propagada nos spans */
  metadata?: Record<string, string>;
}

export interface AiAgentOptions {
  model: string;
  apiKey: string;
  sessionId?: string;
  sessionDir?: string;
  maxSteps?: number;
  system?: string | { append: string };
  /** Working directory for project context discovery (AGENTS.md/CLAUDE.md). Defaults to process.cwd(). */
  cwd?: string;
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
  /** Usage percentage (0-1) at which automatic compaction triggers. Default: 0.65 */
  compactThreshold?: number;
  /** Disable automatic context compaction. Default: false */
  disableCompaction?: boolean;
  /** Custom stop condition. Complements maxSteps — whichever triggers first. */
  stopWhen?: (event: { type: "step_finish"; step: number; toolCalls: string[]; finishReason: string }) => boolean;
  /** Callback executed before each step. Returns overrides for model, tools, toolChoice. */
  prepareStep?: (context: PrepareStepContext) => PrepareStepResult | undefined;
  /** Middleware pipeline applied to the model. Executed in array order. */
  middleware?: LanguageModelMiddleware[];
  /** Configuracao de telemetria OpenTelemetry */
  telemetry?: AiTelemetryOptions;
  /** Aliases de modelo customizados: nome amigavel → model ID completo (ex: { fast: "anthropic/claude-haiku-4.5" }) */
  modelAliases?: Record<string, string>;
  /** Se true, tools sensíveis executam sem pedir aprovação. Default: true (backward compat). */
  autoApprove?: boolean;
  /** Callback invocado quando uma tool precisa de aprovação. Retorna true para aprovar, false para rejeitar. */
  onToolApproval?: (request: ToolApprovalRequest) => Promise<boolean>;
  /** Habilita reparo automatico de tool calls malformadas. Default: true */
  repairToolCalls?: boolean;
  /** Maximo de tentativas de reparo por tool call. Default: 1 */
  maxRepairAttempts?: number;
}
