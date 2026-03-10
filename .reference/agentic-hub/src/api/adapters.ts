import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AdapterConfig } from "./types";

export const adaptersQuery = queryOptions({
  queryKey: ["adapters"],
  queryFn: () => api.get<AdapterConfig[]>("/adapters"),
});

export const adapterQuery = (scope: string, slug: string) =>
  queryOptions({
    queryKey: ["adapters", scope, slug],
    queryFn: () => api.get<AdapterConfig>(`/adapters/${scope}/${slug}`),
  });

export function useUpdateAdapter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      scope,
      slug,
      ...data
    }: {
      scope: string;
      slug: string;
    } & Record<string, unknown>) =>
      api.patch<AdapterConfig>(`/adapters/${scope}/${slug}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adapters"] }),
  });
}

export function useDeleteAdapter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ scope, slug }: { scope: string; slug: string }) =>
      api.delete(`/adapters/${scope}/${slug}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adapters"] }),
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: ({ scope, slug }: { scope: string; slug: string }) =>
      api.post<{ status: string; message: string }>(
        `/adapters/${scope}/${slug}/test`
      ),
  });
}
