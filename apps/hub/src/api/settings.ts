import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface SystemSettings {
  activePlan: string;
  plans: Record<string, unknown>;
}

export function settingsQueryOptions() {
  return queryOptions({
    queryKey: ["settings"],
    queryFn: () => request<SystemSettings>("/settings"),
  });
}
