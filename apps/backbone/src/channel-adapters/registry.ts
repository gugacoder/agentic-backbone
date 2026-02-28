import { eventBus } from "../events/index.js";
import type {
  ChannelAdapter,
  ChannelAdapterContext,
  ChannelAdapterFactory,
} from "./types.js";

class ChannelAdapterRegistry {
  private factories = new Map<string, ChannelAdapterFactory>();
  private instances = new Map<string, ChannelAdapter>();

  register(slug: string, factory: ChannelAdapterFactory): void {
    this.factories.set(slug, factory);
  }

  async resolve(slug: string, config: Record<string, unknown>): Promise<ChannelAdapter> {
    // Cache key: singleton for built-in (slug only), per-channel for external
    const channelId = (config["channel-id"] ?? config.slug) as string | undefined;
    const cacheKey = channelId ? `${slug}:${channelId}` : slug;

    const cached = this.instances.get(cacheKey);
    if (cached) return cached;

    const factory = this.factories.get(slug);
    if (!factory) {
      throw new Error(`[channel-adapters] no factory registered for slug: ${slug}`);
    }

    const context: ChannelAdapterContext = {
      eventBus,
      log: (msg: string) => console.log(`[channel-adapter:${slug}] ${msg}`),
      env: process.env as Record<string, string | undefined>,
    };

    const adapter = await factory(config, context);
    this.instances.set(cacheKey, adapter);
    return adapter;
  }

  list(): string[] {
    return [...this.factories.keys()];
  }

  async shutdownAll(): Promise<void> {
    for (const [key, adapter] of this.instances) {
      try {
        await adapter.close?.();
      } catch (err) {
        console.error(`[channel-adapters] error closing ${key}:`, err);
      }
    }
    this.instances.clear();
  }
}

export const channelAdapterRegistry = new ChannelAdapterRegistry();
