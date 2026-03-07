import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface Channel {
  slug: string;
  owner: string;
  type: string;
  metadata: Record<string, unknown>;
  description: string;
  listeners: number;
}

export function channelsQueryOptions() {
  return queryOptions({
    queryKey: ["channels"],
    queryFn: () => request<Channel[]>("/channels"),
  });
}

export function channelQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ["channels", slug],
    queryFn: () => request<Channel>(`/channels/${slug}`),
  });
}
