import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "node:crypto";
import { findChannelByMetadata } from "../../channels/lookup.js";
import { routeInboundMessage } from "../../channels/delivery/inbound-router.js";
import { credentialSchema, optionsSchema } from "./schemas.js";
import type { ResolvedAdapter } from "../types.js";

export interface SlackRouteDeps {
  findAdapter: (slug: string) => Promise<ResolvedAdapter | null>;
}

/**
 * Slack Events API routes mounted at /connectors/slack/
 *
 * POST /:adapterId/events
 *   - Verifies X-Slack-Signature (HMAC-SHA256 with signing secret)
 *   - Responds to url_verification challenges
 *   - Filters by listen_events and channel_whitelist
 *   - Routes inbound messages to channel adapters
 */
export function createSlackRoutes(deps: SlackRouteDeps): Hono {
  const app = new Hono();

  app.post("/:adapterId/events", async (c) => {
    const adapterId = c.req.param("adapterId");

    const adapter = await deps.findAdapter(adapterId);
    if (!adapter) return c.json({ error: "adapter not found" }, 404);

    const credResult = credentialSchema.safeParse(adapter.credential);
    if (!credResult.success) return c.json({ error: "invalid config" }, 500);

    const optsResult = optionsSchema.safeParse(adapter.options);
    const opts = optsResult.success
      ? optsResult.data
      : { listen_events: ["app_mention", "message"], channel_whitelist: [] };

    // Read raw body for HMAC validation
    const rawBody = await c.req.text();

    // Validate X-Slack-Signature
    const slackSignature = c.req.header("x-slack-signature");
    const slackTimestamp = c.req.header("x-slack-request-timestamp");

    if (!slackSignature || !slackTimestamp) {
      return c.json({ error: "unauthorized" }, 401);
    }

    // Replay attack protection: reject requests older than 5 minutes
    const tsNum = parseInt(slackTimestamp, 10);
    if (Math.abs(Date.now() / 1000 - tsNum) > 300) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const sigBaseString = `v0:${slackTimestamp}:${rawBody}`;
    const expected =
      "v0=" +
      createHmac("sha256", credResult.data.signing_secret)
        .update(sigBaseString)
        .digest("hex");

    const sigBuf = Buffer.from(slackSignature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return c.json({ error: "unauthorized" }, 401);
    }

    // Parse body
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return c.json({ error: "invalid json" }, 400);
    }

    // url_verification challenge
    if (payload["type"] === "url_verification") {
      return c.json({ challenge: payload["challenge"] });
    }

    // Process event_callback
    if (payload["type"] === "event_callback") {
      const event = payload["event"] as Record<string, unknown> | undefined;
      if (!event) return c.json({ ok: true });

      const eventType = event["type"] as string | undefined;
      const channelId = event["channel"] as string | undefined;
      const userId = event["user"] as string | undefined;
      const text = (event["text"] as string | undefined) ?? "";
      const ts = event["ts"] as string | undefined;
      const threadTs = event["thread_ts"] as string | undefined;

      // Filter by listen_events
      if (eventType && !opts.listen_events.includes(eventType)) {
        return c.json({ ok: true });
      }

      // Filter by channel_whitelist
      if (
        opts.channel_whitelist.length > 0 &&
        channelId &&
        !opts.channel_whitelist.includes(channelId)
      ) {
        return c.json({ ok: true });
      }

      // Ignore bot messages to prevent loops
      if (event["bot_id"]) {
        return c.json({ ok: true });
      }

      if (!userId || !channelId || !text.trim()) {
        return c.json({ ok: true });
      }

      // Find channels configured for this adapter
      const channel =
        findChannelByMetadata("instance", adapterId) ??
        findChannelByMetadata("channel-adapter", "slack");

      if (channel) {
        setImmediate(() => {
          routeInboundMessage(channel.slug, {
            senderId: userId,
            content: text,
            ts: Date.now(),
            metadata: {
              channelId,
              slackTs: ts,
              threadTs: threadTs ?? ts,
              adapterId,
            },
          }).catch((err: unknown) => {
            console.error("[slack-routes] routeInboundMessage error:", err);
          });
        });
      }
    }

    return c.json({ ok: true });
  });

  return app;
}
