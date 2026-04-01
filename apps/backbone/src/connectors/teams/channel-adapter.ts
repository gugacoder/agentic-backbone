import { credentialSchema, optionsSchema } from "./schemas.js";
import { createTeamsClient } from "./client.js";
import type { ConnectorContext } from "../types.js";

/**
 * Registers the "teams" channel adapter.
 *
 * Channel CHANNEL.md frontmatter should include:
 *   channel-adapter: teams
 *   instance: <adapterId>   # the ADAPTER.yaml slug
 *
 * The adapter sends replies to the Teams channel via Incoming Webhook.
 */
export function registerTeamsChannelAdapter(ctx: ConnectorContext): void {
  ctx.registerChannelAdapter("teams", (channelConfig) => {
    const adapterId = channelConfig.instance as string;

    return {
      slug: "teams",

      async send({ content }) {
        const { connectorRegistry } = await import("../index.js");
        const adapter = connectorRegistry.findAdapter(adapterId);
        if (!adapter) {
          console.error(`[teams-adapter] adapter "${adapterId}" not found`);
          return;
        }

        const credResult = credentialSchema.safeParse(adapter.credential);
        if (!credResult.success) {
          console.error(`[teams-adapter] invalid credential for "${adapterId}"`);
          return;
        }

        const optsResult = optionsSchema.safeParse(adapter.options);
        const opts = optsResult.success ? optsResult.data : { adaptive_cards: false };

        const client = createTeamsClient(credResult.data, opts);
        try {
          await client.sendMessage(content);
        } catch (err) {
          console.error(`[teams-adapter] sendMessage failed:`, err);
        }
      },

      health() {
        return { status: "healthy" as const };
      },
    };
  });
}
