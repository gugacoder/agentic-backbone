import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { usersDir } from "../context/paths.js";
import { readYaml } from "../context/readers.js";
import { ChannelYmlSchema } from "../context/schemas.js";
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
      const ymlPath = join(channelsDir, channelSlug, "CHANNEL.yml");
      if (!existsSync(ymlPath)) continue;

      const raw = readYaml(ymlPath);
      const result = ChannelYmlSchema.safeParse(raw);
      if (!result.success) {
        console.warn(`[channels] invalid CHANNEL.yml for ${channelSlug}:`, result.error.issues);
        continue;
      }
      const data = result.data;

      map.set(channelSlug, {
        slug: data.slug ?? channelSlug,
        owner: data.owner ?? userSlug,
        type: data.type,
        description: data.description,
        agent: data.agent,
        "channel-adapter": data["channel-adapter"],
        instructions: data.instructions,
        options: data.options ?? {},
        metadata: data as Record<string, unknown>,
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
