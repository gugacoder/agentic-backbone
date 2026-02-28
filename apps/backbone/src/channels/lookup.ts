import { listChannels } from "./registry.js";
import type { ChannelConfig } from "./types.js";

export function findChannelByMetadata(
  key: string,
  value: unknown
): ChannelConfig | undefined {
  return listChannels().find((ch) => ch.metadata[key] === value);
}

export function findChannelsByAdapter(
  adapterSlug: string
): ChannelConfig[] {
  return listChannels().filter(
    (ch) => ch.metadata["channel-adapter"] === adapterSlug
  );
}
