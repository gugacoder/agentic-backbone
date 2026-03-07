import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface LlmProfile {
  model: string;
}

export interface LlmPlan {
  label: string;
  description: string;
  profiles: Record<string, LlmProfile>;
  effort?: "low" | "medium" | "high" | "max";
  thinking?:
    | { type: "adaptive" }
    | { type: "enabled"; budgetTokens: number }
    | { type: "disabled" };
}

export interface LlmConfig {
  active: string;
  plans: Record<string, LlmPlan>;
}

export function llmSettingsQueryOptions() {
  return queryOptions({
    queryKey: ["settings", "llm"],
    queryFn: () => request<LlmConfig>("/settings/llm"),
  });
}

export function activateLlmPlan(active: string) {
  return request<LlmConfig>("/settings/llm", {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
}

export type WebSearchProvider = "duckduckgo" | "brave" | "none";

export interface WebSearchConfig {
  provider: WebSearchProvider;
}

export function webSearchSettingsQueryOptions() {
  return queryOptions({
    queryKey: ["settings", "web-search"],
    queryFn: () => request<WebSearchConfig>("/settings/web-search"),
  });
}

export function updateWebSearchProvider(provider: WebSearchProvider) {
  return request<WebSearchConfig>("/settings/web-search", {
    method: "PATCH",
    body: JSON.stringify({ provider }),
  });
}

export interface SystemInfo {
  version: string;
  nodeVersion: string;
  platform: string;
  contextDir: string;
}

export interface SystemEnv {
  OPENROUTER_API_KEY: boolean;
  OPENAI_API_KEY: boolean;
  BACKBONE_PORT: string;
  NODE_ENV: string;
}

export function systemInfoQueryOptions() {
  return queryOptions({
    queryKey: ["system", "info"],
    queryFn: () => request<SystemInfo>("/system/info"),
  });
}

export function systemEnvQueryOptions() {
  return queryOptions({
    queryKey: ["system", "env"],
    queryFn: () => request<SystemEnv>("/system/env"),
  });
}
