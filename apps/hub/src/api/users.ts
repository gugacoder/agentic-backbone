import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface UserPermissions {
  canCreateAgents: boolean;
  canCreateChannels: boolean;
  maxAgents: number;
}

export interface User {
  slug: string;
  displayName: string;
  email: string;
  permissions: UserPermissions;
}

export function usersQueryOptions() {
  return queryOptions({
    queryKey: ["users"],
    queryFn: () => request<User[]>("/users"),
  });
}
