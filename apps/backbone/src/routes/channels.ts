import { Hono } from "hono";
import { listChannels, getChannel } from "../channels/registry.js";
import { createChannel, updateChannel, deleteChannel } from "../channels/manager.js";
import { createSSEHandler, sseHub } from "../events/sse.js";
import { assemblePrompt } from "../context/index.js";
import { runAgent } from "../agent/index.js";
import { deliverToSystemChannel, deliverToChannel } from "../channels/system-channel.js";
import { getAuthUser, filterByOwner, assertOwnership } from "./auth-helpers.js";
import { formatError } from "../utils/errors.js";
import { collectAgentResult } from "../utils/agent-stream.js";
import { agentDir } from "../context/paths.js";
import { channelAdapterRegistry } from "../channels/delivery/index.js";
import type { ChannelConfig } from "../channels/types.js";

async function enrichWithHealth(channel: ChannelConfig) {
  const adapterSlug = channel["channel-adapter"];
  let connected = false;
  if (adapterSlug) {
    try {
      const adapter = await channelAdapterRegistry.resolve(adapterSlug, {
        ...channel.options,
        "channel-id": channel.slug,
        "channel-adapter": adapterSlug,
      });
      const health = adapter.health?.();
      connected = health?.status === "healthy";
    } catch {
      // adapter not available
    }
  }
  return { ...channel, metadata: { ...channel.metadata, connected } };
}

export const channelRoutes = new Hono();

// --- List Channels ---

channelRoutes.get("/channels", async (c) => {
  const auth = getAuthUser(c);
  const channels = await Promise.all(
    filterByOwner(listChannels(), auth).map(async (ch) => ({
      ...(await enrichWithHealth(ch)),
      listeners: sseHub.getClientCount(ch.slug),
    }))
  );
  return c.json(channels);
});

// --- Get Channel ---

channelRoutes.get("/channels/:slug", async (c) => {
  const channel = getChannel(c.req.param("slug"));
  if (!channel) return c.json({ error: "not found" }, 404);
  const denied = assertOwnership(c, channel.owner);
  if (denied) return denied;
  return c.json({
    ...(await enrichWithHealth(channel)),
    listeners: sseHub.getClientCount(channel.slug),
  });
});

// --- Create Channel ---

channelRoutes.post("/channels", async (c) => {
  const auth = getAuthUser(c);
  const body = await c.req.json();
  if (auth.role !== "sysuser") {
    body.owner = auth.user;
  }
  try {
    const channel = createChannel(body);
    return c.json(channel, 201);
  } catch (err) {
    return c.json({ error: formatError(err) }, 400);
  }
});

// --- Update Channel ---

channelRoutes.patch("/channels/:slug", async (c) => {
  const slug = c.req.param("slug");
  const channel = getChannel(slug);
  if (!channel) return c.json({ error: "not found" }, 404);
  const denied = assertOwnership(c, channel.owner);
  if (denied) return denied;

  const body = await c.req.json();
  try {
    const updated = updateChannel(channel.owner, slug, body);
    return c.json(updated);
  } catch (err) {
    return c.json({ error: formatError(err) }, 400);
  }
});

// --- Delete Channel ---

channelRoutes.delete("/channels/:slug", (c) => {
  const slug = c.req.param("slug");
  const channel = getChannel(slug);
  if (!channel) return c.json({ error: "not found" }, 404);
  const denied = assertOwnership(c, channel.owner);
  if (denied) return denied;

  const deleted = deleteChannel(channel.owner, slug);
  if (!deleted) return c.json({ error: "delete failed" }, 500);
  return c.json({ status: "deleted" });
});

// --- Reconnect ---

channelRoutes.post("/channels/:slug/reconnect", async (c) => {
  const channel = getChannel(c.req.param("slug"));
  if (!channel) return c.json({ error: "not found" }, 404);
  const denied = assertOwnership(c, channel.owner);
  if (denied) return denied;

  const adapterSlug = channel["channel-adapter"];
  if (!adapterSlug) return c.json({ error: "no adapter" }, 400);

  try {
    const adapter = await channelAdapterRegistry.resolve(adapterSlug, {
      ...channel.options,
      "channel-id": channel.slug,
      "channel-adapter": adapterSlug,
    });
    if (!adapter.reconnect) return c.json({ error: "adapter does not support reconnect" }, 400);
    await adapter.reconnect();
    return c.json({ status: "reconnecting" });
  } catch (err) {
    return c.json({ error: formatError(err) }, 500);
  }
});

// --- Disconnect ---

channelRoutes.post("/channels/:slug/disconnect", async (c) => {
  const channel = getChannel(c.req.param("slug"));
  if (!channel) return c.json({ error: "not found" }, 404);
  const denied = assertOwnership(c, channel.owner);
  if (denied) return denied;

  const adapterSlug = channel["channel-adapter"];
  if (!adapterSlug) return c.json({ error: "no adapter" }, 400);

  try {
    const adapter = await channelAdapterRegistry.resolve(adapterSlug, {
      ...channel.options,
      "channel-id": channel.slug,
      "channel-adapter": adapterSlug,
    });
    if (!adapter.disconnect) return c.json({ error: "adapter does not support disconnect" }, 400);
    await adapter.disconnect();
    return c.json({ status: "disconnecting" });
  } catch (err) {
    return c.json({ error: formatError(err) }, 500);
  }
});

// --- Channel SSE ---

channelRoutes.get("/channels/:slug/events", (c) => {
  const slug = c.req.param("slug");
  const channel = getChannel(slug);
  if (!channel) return c.json({ error: "not found" }, 404);
  const denied = assertOwnership(c, channel.owner);
  if (denied) return denied;
  return createSSEHandler(slug)(c);
});

// --- Channel Emit ---

channelRoutes.post("/channels/:slug/emit", async (c) => {
  const channelId = c.req.param("slug");
  const channel = getChannel(channelId);
  if (!channel) return c.json({ error: "not found" }, 404);

  const { content, agentId } = await c.req.json<{
    content: string;
    agentId?: string;
  }>();
  if (!content) return c.json({ error: "content is required" }, 400);

  await deliverToChannel(channelId, agentId ?? "system.main", content);
  return c.json({ status: "delivered", channelId }, 200);
});

// --- Channel Messages ---

channelRoutes.post("/channels/:slug/messages", async (c) => {
  const channelId = c.req.param("slug");
  const channel = getChannel(channelId);
  if (!channel) return c.json({ error: "not found" }, 404);
  const denied = assertOwnership(c, channel.owner);
  if (denied) return denied;

  const { message, agentId } = await c.req.json<{
    message: string;
    agentId?: string;
  }>();
  if (!message) return c.json({ error: "message is required" }, 400);

  const agent = agentId ?? "system.main";

  (async () => {
    try {
      const assembled = await assemblePrompt(agent, "conversation", { userMessage: message });
      if (!assembled) return;
      const { fullText } = await collectAgentResult(runAgent(assembled.userMessage, { role: "conversation", system: assembled.system, cwd: agentDir(agent) }));
      if (fullText) {
        deliverToSystemChannel(agent, fullText);
      }
    } catch (err) {
      console.error(`[channels/${channelId}/messages] failed:`, err);
    }
  })();

  return c.json({ status: "accepted" }, 202);
});
