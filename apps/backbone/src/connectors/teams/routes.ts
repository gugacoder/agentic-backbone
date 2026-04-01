import { Hono } from "hono";
import { timingSafeEqual } from "node:crypto";
import { findChannelByMetadata } from "../../channels/lookup.js";
import { routeInboundMessage } from "../../channels/delivery/inbound-router.js";
import { credentialSchema, optionsSchema } from "./schemas.js";
import type { ResolvedAdapter } from "../types.js";

export interface TeamsRouteDeps {
  findAdapter: (slug: string) => Promise<ResolvedAdapter | null>;
}

/**
 * Power Automate inbound payload shape (simplified):
 *   { from: string (email), channel: string, text: string, timestamp: string }
 */
interface PowerAutomatePayload {
  from: string;
  channel?: string;
  text: string;
  timestamp?: string;
}

export function createTeamsRoutes(deps: TeamsRouteDeps): Hono {
  const app = new Hono();

  app.post("/:adapterId/events", async (c) => {
    const adapterId = c.req.param("adapterId");

    const adapter = await deps.findAdapter(adapterId);
    if (!adapter) return c.json({ error: "adapter not found" }, 404);

    const credResult = credentialSchema.safeParse(adapter.credential);
    if (!credResult.success) return c.json({ error: "invalid config" }, 500);

    optionsSchema.safeParse(adapter.options);

    // Validate bot_endpoint_secret via Authorization header or query param
    const authHeader = c.req.header("authorization") ?? "";
    const secret = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : (c.req.query("secret") ?? "");

    const expected = credResult.data.bot_endpoint_secret;

    let authorized = false;
    try {
      const sBuf = Buffer.from(secret);
      const eBuf = Buffer.from(expected);
      authorized = sBuf.length === eBuf.length && timingSafeEqual(sBuf, eBuf);
    } catch {
      authorized = false;
    }

    if (!authorized) {
      return c.json({ error: "unauthorized" }, 401);
    }

    let payload: PowerAutomatePayload;
    try {
      payload = await c.req.json<PowerAutomatePayload>();
    } catch {
      return c.json({ error: "invalid json" }, 400);
    }

    const { from, channel, text, timestamp } = payload;

    if (!from || !text?.trim()) {
      return c.json({ ok: true });
    }

    const teamsChannel =
      findChannelByMetadata("instance", adapterId) ??
      findChannelByMetadata("channel-adapter", "teams");

    if (teamsChannel) {
      setImmediate(() => {
        routeInboundMessage(teamsChannel.slug, {
          senderId: from,
          content: text,
          ts: timestamp ? new Date(timestamp).getTime() : Date.now(),
          metadata: {
            channel: channel ?? "teams",
            from,
            adapterId,
          },
        }).catch((err: unknown) => {
          console.error("[teams-routes] routeInboundMessage error:", err);
        });
      });
    }

    return c.json({ ok: true });
  });

  return app;
}
