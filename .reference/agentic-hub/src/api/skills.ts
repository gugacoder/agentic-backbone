import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Resource } from "./types";

export const skillsQuery = queryOptions({
  queryKey: ["skills"],
  queryFn: () => api.get<Resource[]>("/skills"),
});

export function agentSkillsQuery(agentId: string) {
  return queryOptions({
    queryKey: ["skills", agentId],
    queryFn: () => api.get<Resource[]>(`/skills?agentId=${agentId}`),
    enabled: !!agentId,
  });
}

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { slug: string; scope: string; name: string; description?: string; body?: string }) =>
      api.post<Resource>("/skills", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });
}

export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ scope, slug, ...data }: { scope: string; slug: string } & Record<string, unknown>) =>
      api.patch<Resource>(`/skills/${scope}/${slug}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ scope, slug }: { scope: string; slug: string }) =>
      api.delete(`/skills/${scope}/${slug}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });
}

export function useAssignSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { sourceScope: string; slug: string; agentId: string }) =>
      api.post<Resource>("/skills/assign", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });
}
