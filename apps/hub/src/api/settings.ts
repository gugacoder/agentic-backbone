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
