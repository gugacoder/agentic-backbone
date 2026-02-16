import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LlmConfig, LlmProvider } from "./types";

export const llmConfigQuery = queryOptions({
  queryKey: ["settings", "llm"],
  queryFn: () => api.get<LlmConfig>("/settings/llm"),
});

export function useUpdateLlmPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (active: string) =>
      api.patch<LlmConfig>("/settings/llm", { active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "llm"] });
    },
  });
}

export function useUpdateLlmProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: LlmProvider) =>
      api.patch<LlmConfig>("/settings/llm", { provider }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "llm"] });
    },
  });
}
