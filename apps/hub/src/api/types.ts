// --- Agent ---
export interface Agent {
  id: string;
  owner: string;
  slug: string;
  delivery: string;
  enabled: boolean;
  heartbeat: { enabled: boolean; intervalMs: number };
  metadata: Record<string, unknown>;
  description: string;
}

// --- Channel ---
export interface Channel {
  slug: string;
  owner: string;
  type: string;
  metadata: Record<string, unknown>;
  description: string;
  listeners?: number;
}

// --- User ---
export interface User {
  slug: string;
  displayName: string;
  permissions: {
    canCreateAgents: boolean;
    canCreateChannels: boolean;
    maxAgents: number;
  };
}

// --- Adapter ---
export interface AdapterConfig {
  slug: string;
  name: string;
  connector: string;
  policy: string;
  description: string;
  source: string;
  dir: string;
  connectorDir: string | null;
  content: string;
  metadata: Record<string, unknown>;
}

// --- Resource ---
export interface Resource {
  slug: string;
  path: string;
  source: string;
  metadata: Record<string, unknown>;
  content: string;
}

// --- Health ---
export interface HealthStatus {
  status: string;
  heartbeat: Record<string, unknown>;
  agents: { id: string; heartbeat: boolean }[];
  channels: { slug: string; type: string; listeners: number }[];
}

// --- System ---
export interface SystemStats {
  uptime: number;
  agents: number;
  channels: number;
  sessions: number;
  memoryUsage: NodeJS.MemoryUsage;
}

export interface SystemInfo {
  version: string;
  nodeVersion: string;
  platform: string;
  contextDir: string;
}

// --- LLM Settings ---
export interface LlmProfile {
  model: string;
}

export interface LlmPlan {
  label: string;
  description: string;
  profiles: Record<string, LlmProfile>;
  effort?: "low" | "medium" | "high" | "max";
  thinking?: { type: "adaptive" } | { type: "enabled"; budgetTokens: number } | { type: "disabled" };
}

export type LlmProvider = "claude" | "ai";

export interface LlmConfig {
  provider: LlmProvider;
  active: string;
  plans: Record<string, Record<string, LlmPlan>>;
}

// --- Heartbeat ---
export interface UsageData {
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

export interface HeartbeatLogEntry {
  id: number;
  agent_id: string;
  ts: string;
  status: string;
  duration_ms: number | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  cost_usd: number;
  num_turns: number;
  stop_reason: string | null;
  reason: string | null;
  preview: string | null;
}

export interface HeartbeatStats {
  totalExecutions: number;
  countByStatus: Record<string, number>;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  totalCostUsd: number;
  avgDurationMs: number;
}

export interface GlobalAgentStats {
  agentId: string;
  totalExecutions: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  avgDurationMs: number;
  countByStatus: Record<string, number>;
}

// --- Jobs ---
export type JobStatus = "running" | "completed" | "failed" | "timeout";

export interface JobSummary {
  id: string;
  agentId: string;
  command: string;
  pid: number;
  status: JobStatus;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  exitCode?: number | null;
  tail: string;
  truncated: boolean;
  resourceStats?: { cpu: number; memory: number; sampledAt: number };
}

// --- Session ---
export interface Session {
  session_id: string;
  user_id: string;
  agent_id: string;
  sdk_session_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  ts: string;
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AgentEvent {
  type: "init" | "text" | "result" | "usage";
  sessionId?: string;
  content?: string;
  usage?: UsageData;
}

// --- Memory ---
export interface MemoryChunk {
  id: number;
  fileId: number;
  path: string;
  startLine: number;
  endLine: number;
  text: string;
}

export interface MemorySearchResult {
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
  source: string;
  citation: string;
}

export interface MemoryStatus {
  fileCount: number;
  chunkCount: number;
}
