import { Hono } from "hono";
import { listChannels, getChannel } from "../channels/registry.js";
import { createChannel, updateChannel, deleteChannel } from "../channels/manager.js";
import { createSSEHandler, sseHub } from "../events/sse.js";
import { assembleConversationPrompt } from "../context/index.js";
import { runAgent } from "../agent/index.js";
import { deliverToSystemChannel, deliverToChannel } from "../channels/system-channel.js";
import { getAuthUser, filterByOwner, assertOwnership } from "./auth-helpers.js";

export const channelRoutes = new Hono();

// --- List Channels ---

channelRoutes.get("/channels", (c) => {
  const auth = getAuthUser(c);
  const channels = filterByOwner(listChannels(), auth).map((ch) => ({
    ...ch,
    listeners: sseHub.getClientCount(ch.slug),
  }));
  return c.json(channels);
});

// --- Get Channel ---

channelRoutes.get("/channels/:slug", (c) => {
  const channel = getChannel(c.req.param("slug"));
  if (!channel) return c.json({ error: "not found" }, 404);
  const denied = assertOwnership(c, channel.owner);
  if (denied) return denied;
  return c.json({
    ...channel,
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
    return c.json({ error: (err as Error).message }, 400);
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
    return c.json({ error: (err as Error).message }, 400);
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

  deliverToChannel(channelId, agentId ?? "system.main", content);
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
      const prompt = await assembleConversationPrompt(agent, message);
      let fullText = "";
      for await (const event of runAgent(prompt, { role: "conversation" })) {
        if (event.type === "result" && event.content) {
          fullText = event.content;
        } else if (event.type === "text" && event.content) {
          fullText += event.content;
        }
      }
      if (fullText) {
        deliverToSystemChannel(agent, fullText);
      }
    } catch (err) {
      console.error(`[channels/${channelId}/messages] failed:`, err);
    }
  })();

  return c.json({ status: "accepted" }, 202);
});
