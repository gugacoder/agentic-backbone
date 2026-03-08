import { credentialSchema } from "./schemas.js";
import { createSlackClient } from "./client.js";
import type { ConnectorContext } from "../types.js";

/**
 * Registers the "slack" channel adapter.
 *
 * Channel CHANNEL.md frontmatter should include:
 *   channel-adapter: slack
 *   instance: <adapterId>   # the ADAPTER.yaml slug
 *
 * The adapter sends replies to the same Slack channel, threading the response
 * when metadata.threadTs is provided.
 */
export function registerSlackChannelAdapter(ctx: ConnectorContext): void {
  ctx.registerChannelAdapter("slack", (channelConfig) => {
    const adapterId = channelConfig.instance as string;

    return {
      slug: "slack",

      async send({ content, metadata }) {
        const channelId = metadata?.channelId as string | undefined;
        const threadTs = metadata?.threadTs as string | undefined;

        if (!channelId) {
          console.warn("[slack-adapter] send sem channelId — ignorando");
          return;
        }

        const { connectorRegistry } = await import("../index.js");
        const adapter = connectorRegistry.findAdapter(adapterId);
        if (!adapter) {
          console.error(`[slack-adapter] adapter "${adapterId}" not found`);
          return;
        }

        const credResult = credentialSchema.safeParse(adapter.credential);
        if (!credResult.success) {
          console.error(`[slack-adapter] invalid credential for "${adapterId}"`);
          return;
        }

        const client = createSlackClient(credResult.data);
        try {
          await client.postMessage(channelId, content, threadTs);
        } catch (err) {
          console.error(`[slack-adapter] postMessage failed:`, err);
        }
      },

      health() {
        return { status: "healthy" as const };
      },
    };
  });
}
