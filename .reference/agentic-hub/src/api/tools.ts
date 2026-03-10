import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Resource } from "./types";

export const toolsQuery = queryOptions({
  queryKey: ["tools"],
  queryFn: () => api.get<Resource[]>("/tools"),
});

export function useCreateTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { slug: string; scope: string; name: string; description?: string; body?: string }) =>
      api.post<Resource>("/tools", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tools"] }),
  });
}

export function useUpdateTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ scope, slug, ...data }: { scope: string; slug: string } & Record<string, unknown>) =>
      api.patch<Resource>(`/tools/${scope}/${slug}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tools"] }),
  });
}

export function useDeleteTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ scope, slug }: { scope: string; slug: string }) =>
      api.delete(`/tools/${scope}/${slug}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tools"] }),
  });
}
