import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface CronJob {
  slug: string;
  agentId: string;
  name: string;
  schedule: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

export function cronJobsQueryOptions() {
  return queryOptions({
    queryKey: ["cron-jobs"],
    queryFn: () => request<CronJob[]>("/cron/jobs"),
  });
}

export function cronJobQueryOptions(agentId: string, slug: string) {
  return queryOptions({
    queryKey: ["cron-jobs", agentId, slug],
    queryFn: () => request<CronJob>(`/cron/jobs/${agentId}/${slug}`),
  });
}
