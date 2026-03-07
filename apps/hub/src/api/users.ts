import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface User {
  slug: string;
  name: string;
  role: string;
}

export function usersQueryOptions() {
  return queryOptions({
    queryKey: ["users"],
    queryFn: () => request<User[]>("/users"),
  });
}
