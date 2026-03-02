// Proxy (primary API)
export { runAgent } from "./proxy.js";
export { AgentRunOptionsSchema, AgentEventSchema, UsageDataSchema } from "./schemas.js";
export type { AgentEvent, UsageData, AgentRunOptions } from "./schemas.js";

// AI agent (internal, kept for backward compat)
export { runAiAgent } from "./agent.js";
export type { AiAgentEvent, AiUsageData, AiAgentOptions, AiTodoItem, McpServerConfig, ContextUsage, PrepareStepContext, PrepareStepResult, AiTelemetryOptions, ToolApprovalRequest } from "./types.js";
export { getContextUsage } from "./context/usage.js";
export type { GetContextUsageOptions } from "./context/usage.js";
export { compactMessages } from "./context/compaction.js";
export type { CompactOptions, CompactResult } from "./context/compaction.js";
export { getSystemPrompt, discoverProjectContext } from "./prompts/assembly.js";
export { createAskUserTool } from "./tools/ask-user.js";
export type { AskUserCallback } from "./tools/ask-user.js";
export { webFetchTool } from "./tools/web-fetch.js";
export { createWebSearchTool } from "./tools/web-search.js";
export type { WebSearchProvider, WebSearchResult } from "./tools/web-search.js";
export { createTaskTool } from "./tools/task.js";
export type { TaskConfig } from "./tools/task.js";
export { createBatchTool } from "./tools/batch.js";
export { applyPatchTool, createApplyPatchTool } from "./tools/apply-patch.js";
export { createBashTool } from "./tools/bash.js";
export { createWriteTool } from "./tools/write.js";
export { createEditTool } from "./tools/edit.js";
export { createMultiEditTool } from "./tools/multi-edit.js";
export { createCodeSearchTool } from "./tools/code-search.js";
export type { CodeSearchProvider, CodeSearchResult } from "./tools/code-search.js";
export { httpRequestTool } from "./tools/http-request.js";
export { apiSpecTool } from "./tools/api-spec.js";
export { aiGenerateObject, aiStreamObject } from "./structured.js";
export type { AiObjectOptions } from "./structured.js";
export { createAiProviderRegistry } from "./providers.js";
export type { AiProviderConfig } from "./providers.js";
export { createLoggingMiddleware } from "./middleware/logging.js";
export type { LanguageModelMiddleware } from "ai";
export { createToolCallRepairHandler } from "./tool-repair.js";
export type { RepairContext } from "./tool-repair.js";
