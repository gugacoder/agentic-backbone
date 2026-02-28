import { Hono } from "hono";
import { channelAdapterRegistry } from "../channel-adapters/index.js";
import { routeInboundMessage } from "../channel-adapters/inbound-router.js";
import { findChannelByMetadata } from "../channels/lookup.js";
import type { InboundMessage } from "../channel-adapters/types.js";

export const channelAdapterRoutes = new Hono();

// --- List registered adapters ---

channelAdapterRoutes.get("/channel-adapters", (c) => {
  return c.json(channelAdapterRegistry.list());
});

// --- Generic webhook for drop-in adapters ---

channelAdapterRoutes.post("/channel-adapters/:slug/webhook", async (c) => {
  const slug = c.req.param("slug");

  if (!channelAdapterRegistry.list().includes(slug)) {
    return c.json({ error: `adapter "${slug}" not registered` }, 404);
  }

  const body = await c.req.json<{
    channelId?: string;
    senderId: string;
    content: string;
    ts?: number;
    metadata?: Record<string, unknown>;
  }>();

  if (!body.senderId || !body.content) {
    return c.json({ error: "senderId and content are required" }, 400);
  }

  // Resolve channel: explicit channelId or lookup by adapter slug
  let channelId = body.channelId;
  if (!channelId) {
    const channel = findChannelByMetadata("channel-adapter", slug);
    if (!channel) {
      return c.json({ error: `no channel configured for adapter "${slug}"` }, 404);
    }
    channelId = channel.slug;
  }

  const message: InboundMessage = {
    senderId: body.senderId,
    content: body.content,
    ts: body.ts ?? Date.now(),
    metadata: body.metadata,
  };

  // Process asynchronously to avoid blocking the webhook response
  routeInboundMessage(channelId, message).catch((err) => {
    console.error(`[channel-adapters/${slug}/webhook] routing failed:`, err);
  });

  return c.json({ status: "accepted" }, 202);
});
