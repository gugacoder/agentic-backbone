import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { channelDir } from "../context/paths.js";
import { parseFrontmatter, serializeFrontmatter } from "../context/frontmatter.js";
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
  metadata?: Record<string, unknown>;
}

export function createChannel(input: CreateChannelInput): ChannelConfig {
  const dir = channelDir(input.userSlug, input.slug);
  const mdPath = join(dir, "CHANNEL.md");

  if (existsSync(mdPath)) {
    throw new Error(`Channel ${input.slug} already exists`);
  }

  mkdirSync(dir, { recursive: true });

  const meta: Record<string, unknown> = {
    slug: input.slug,
    owner: input.userSlug,
    type: input.type ?? "generic",
    ...input.metadata,
  };

  const content = input.description ?? `# ${input.slug}\n`;
  writeFileSync(mdPath, serializeFrontmatter(meta, content));

  refreshChannelRegistry();
  return getChannel(input.slug)!;
}

export function updateChannel(
  userSlug: string,
  slug: string,
  updates: UpdateChannelInput
): ChannelConfig {
  const dir = channelDir(userSlug, slug);
  const mdPath = join(dir, "CHANNEL.md");

  if (!existsSync(mdPath)) {
    throw new Error(`Channel ${slug} not found`);
  }

  const raw = readFileSync(mdPath, "utf-8");
  const { metadata, content } = parseFrontmatter(raw);

  if (updates.type !== undefined) metadata.type = updates.type;
  if (updates.metadata) {
    for (const [key, value] of Object.entries(updates.metadata)) {
      metadata[key] = value;
    }
  }

  const newContent = updates.description !== undefined ? updates.description : content;
  writeFileSync(mdPath, serializeFrontmatter(metadata, newContent));

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
