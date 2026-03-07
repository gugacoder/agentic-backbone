import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface Channel {
  slug: string;
  name: string;
  type: string;
  owner: string;
  listeners: string[];
  connected: boolean;
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
