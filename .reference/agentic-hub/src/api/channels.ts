import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Channel } from "./types";

export const channelsQuery = queryOptions({
  queryKey: ["channels"],
  queryFn: () => api.get<Channel[]>("/channels"),
});

export function channelQuery(slug: string) {
  return queryOptions({
    queryKey: ["channels", slug],
    queryFn: () => api.get<Channel>(`/channels/${slug}`),
    enabled: !!slug,
  });
}

export function useCreateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { userSlug: string; slug: string; type?: string; description?: string }) =>
      api.post<Channel>("/channels", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channels"] }),
  });
}

export function useUpdateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, ...data }: { slug: string } & Record<string, unknown>) =>
      api.patch<Channel>(`/channels/${slug}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channels"] }),
  });
}

export function useDeleteChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => api.delete(`/channels/${slug}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channels"] }),
  });
}
