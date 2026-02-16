import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { usersDir } from "../context/paths.js";
import { parseFrontmatter } from "../context/frontmatter.js";
import type { ChannelConfig } from "./types.js";

let cache: Map<string, ChannelConfig> | null = null;

function scanChannels(): Map<string, ChannelConfig> {
  const map = new Map<string, ChannelConfig>();
  const uDir = usersDir();
  if (!existsSync(uDir)) return map;

  for (const userSlug of readdirSync(uDir)) {
    const channelsDir = join(uDir, userSlug, "channels");
    if (!existsSync(channelsDir)) continue;

    for (const channelSlug of readdirSync(channelsDir)) {
      const mdPath = join(channelsDir, channelSlug, "CHANNEL.md");
      if (!existsSync(mdPath)) continue;

      const raw = readFileSync(mdPath, "utf-8");
      const { metadata, content } = parseFrontmatter(raw);

      map.set(channelSlug, {
        slug: (metadata.slug as string) ?? channelSlug,
        owner: (metadata.owner as string) ?? userSlug,
        type: (metadata.type as string) ?? "generic",
        metadata,
        description: content.trim(),
      });
    }
  }
  return map;
}

function ensureCache(): Map<string, ChannelConfig> {
  if (!cache) cache = scanChannels();
  return cache;
}

export function listChannels(): ChannelConfig[] {
  return [...ensureCache().values()];
}

export function getChannel(slug: string): ChannelConfig | undefined {
  return ensureCache().get(slug);
}

export function getSystemChannel(): ChannelConfig | undefined {
  return getChannel("system-channel");
}

export function refreshChannelRegistry(): void {
  cache = null;
}
