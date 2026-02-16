import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { JobSummary } from "./types";

export const jobsQuery = queryOptions({
  queryKey: ["jobs"],
  queryFn: () => api.get<JobSummary[]>("/jobs"),
  refetchInterval: 5_000,
});

export function useKillJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) =>
      api.post<{ status: string }>(`/jobs/${jobId}/kill`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useClearJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) =>
      api.delete(`/jobs/${jobId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}
