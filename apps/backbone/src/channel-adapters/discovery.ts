import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseFrontmatter } from "../context/frontmatter.js";
import { sharedDir } from "../context/paths.js";
import { channelAdapterRegistry } from "./registry.js";
import type { ChannelAdapterFactory } from "./types.js";

export async function discoverDropInAdapters(): Promise<void> {
  const baseDir = join(sharedDir(), "channel-adapters");
  if (!existsSync(baseDir)) return;

  for (const slug of readdirSync(baseDir)) {
    const adapterDir = join(baseDir, slug);
    const mdPath = join(adapterDir, "CHANNEL-ADAPTER.md");
    if (!existsSync(mdPath)) continue;

    const raw = readFileSync(mdPath, "utf-8");
    const { metadata } = parseFrontmatter(raw);

    const adapterSlug = (metadata.slug as string) ?? slug;
    const requiresEnv = metadata["requires-env"] as string | string[] | undefined;

    // Check required env vars
    const envKeys = Array.isArray(requiresEnv)
      ? requiresEnv
      : requiresEnv
        ? [requiresEnv]
        : [];

    const missingEnv = envKeys.filter((k) => !process.env[k]);
    if (missingEnv.length > 0) {
      console.warn(
        `[channel-adapters] skipping drop-in "${adapterSlug}": missing env vars: ${missingEnv.join(", ")}`
      );
      continue;
    }

    const handlerPath = join(adapterDir, "handler.mjs");
    if (!existsSync(handlerPath)) {
      console.warn(
        `[channel-adapters] skipping drop-in "${adapterSlug}": handler.mjs not found`
      );
      continue;
    }

    try {
      const handlerUrl = pathToFileURL(handlerPath).href;
      const mod = await import(handlerUrl);
      const factory: ChannelAdapterFactory =
        mod.createChannelAdapter ?? mod.default;

      if (typeof factory !== "function") {
        console.warn(
          `[channel-adapters] skipping drop-in "${adapterSlug}": handler.mjs does not export createChannelAdapter`
        );
        continue;
      }

      channelAdapterRegistry.register(adapterSlug, factory);
      console.log(`[channel-adapters] registered drop-in: ${adapterSlug}`);
    } catch (err) {
      console.error(
        `[channel-adapters] failed to load drop-in "${adapterSlug}":`,
        err
      );
    }
  }
}
