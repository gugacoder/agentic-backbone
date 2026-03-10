import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { User } from "./types";

export const usersQuery = queryOptions({
  queryKey: ["users"],
  queryFn: () => api.get<User[]>("/users"),
});

export function userQuery(slug: string) {
  return queryOptions({
    queryKey: ["users", slug],
    queryFn: () => api.get<User>(`/users/${slug}`),
    enabled: !!slug,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { slug: string; displayName: string; permissions?: Partial<User["permissions"]> }) =>
      api.post<User>("/users", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, ...data }: { slug: string } & Record<string, unknown>) =>
      api.patch<User>(`/users/${slug}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => api.delete(`/users/${slug}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
