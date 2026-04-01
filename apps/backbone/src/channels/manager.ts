import {
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { channelDir } from "../context/paths.js";
import { readYamlAs, writeYamlAs } from "../context/readers.js";
import { ChannelYmlSchema } from "../context/schemas.js";
import { refreshChannelRegistry, getChannel } from "./registry.js";
import type { ChannelConfig } from "./types.js";

export interface CreateChannelInput {
  userSlug: string;
  slug: string;
  type?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateChannelInput {
  type?: string;
  description?: string;
  agent?: string;
  metadata?: Record<string, unknown>;
}

export function createChannel(input: CreateChannelInput): ChannelConfig {
  const dir = channelDir(input.userSlug, input.slug);
  const ymlPath = join(dir, "CHANNEL.yml");

  if (existsSync(ymlPath)) {
    throw new Error(`Channel ${input.slug} already exists`);
  }

  mkdirSync(dir, { recursive: true });

  const config: Record<string, unknown> = {
    slug: input.slug,
    owner: input.userSlug,
    type: input.type ?? "generic",
    description: input.description ?? "",
    ...input.metadata,
  };

  writeYamlAs(ymlPath, config, ChannelYmlSchema);

  refreshChannelRegistry();
  return getChannel(input.slug)!;
}

export function updateChannel(
  userSlug: string,
  slug: string,
  updates: UpdateChannelInput
): ChannelConfig {
  const dir = channelDir(userSlug, slug);
  const ymlPath = join(dir, "CHANNEL.yml");

  if (!existsSync(ymlPath)) {
    throw new Error(`Channel ${slug} not found`);
  }

  const config = readYamlAs(ymlPath, ChannelYmlSchema) as Record<string, unknown>;

  if (updates.type !== undefined) config.type = updates.type;
  if (updates.description !== undefined) config.description = updates.description;
  if (updates.agent !== undefined) config.agent = updates.agent;
  if (updates.metadata) {
    for (const [key, value] of Object.entries(updates.metadata)) {
      config[key] = value;
    }
  }

  writeYamlAs(ymlPath, config, ChannelYmlSchema);

  refreshChannelRegistry();
  return getChannel(slug)!;
}

export function deleteChannel(userSlug: string, slug: string): boolean {
  const dir = channelDir(userSlug, slug);
  if (!existsSync(dir)) return false;

  rmSync(dir, { recursive: true, force: true });
  refreshChannelRegistry();
  return true;
}
