import { Hono } from "hono";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { listAgents } from "../agents/registry.js";
import { listChannels } from "../channels/registry.js";
import { getHeartbeatStatus } from "../heartbeat/index.js";
import { getGlobalHeartbeatStats } from "../heartbeat/log.js";
import { createSSEHandler } from "../events/sse.js";
import { assemblePrompt } from "../context/index.js";
import { runAgent } from "../agent/index.js";
import { deliverToSystemChannel } from "../channels/system-channel.js";
import { CONTEXT_DIR } from "../context/paths.js";
import { db } from "../db/index.js";
import { requireSysuser } from "./auth-helpers.js";
import { getHookSnapshot } from "../hooks/index.js";

export const systemRoutes = new Hono();

// --- System SSE (accessible to all) ---

systemRoutes.get("/system/events", createSSEHandler("system"));

// --- System Messages (sysuser only) ---

systemRoutes.post("/system/messages", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const { message } = await c.req.json<{ message: string }>();
  if (!message) return c.json({ error: "message is required" }, 400);

  (async () => {
    try {
      const prompt = await assemblePrompt("system.main", "conversation", { userMessage: message }) ?? "";
      let fullText = "";
      for await (const event of runAgent(prompt, { role: "conversation" })) {
        if (event.type === "result" && event.content) {
          fullText = event.content;
        } else if (event.type === "text" && event.content) {
          fullText += event.content;
        }
      }
      if (fullText) {
        deliverToSystemChannel("system.main", fullText);
      }
    } catch (err) {
      console.error("[system/messages] failed:", err);
    }
  })();

  return c.json({ status: "accepted" }, 202);
});

// --- System Stats (accessible to all) ---

systemRoutes.get("/system/stats", (c) => {
  const sessions = (
    db.prepare("SELECT COUNT(*) as c FROM sessions").get() as { c: number }
  ).c;

  return c.json({
    uptime: process.uptime(),
    agents: listAgents().length,
    channels: listChannels().length,
    sessions,
    memoryUsage: process.memoryUsage(),
  });
});

// --- Global Heartbeat Stats (accessible to all) ---

systemRoutes.get("/system/heartbeat/stats", (c) => {
  return c.json(getGlobalHeartbeatStats());
});

// --- Hooks Status (accessible to all) ---

systemRoutes.get("/system/hooks", (c) => {
  return c.json(getHookSnapshot());
});

// --- System Info (accessible to all) ---

systemRoutes.get("/system/info", (c) =>
  c.json({
    version: "0.0.1",
    nodeVersion: process.version,
    platform: process.platform,
    contextDir: CONTEXT_DIR,
  })
);

// --- Environment Status (sysuser only) ---

systemRoutes.get("/system/env", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;
  return c.json({
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    BACKBONE_PORT: process.env.BACKBONE_PORT,
    NODE_ENV: process.env.NODE_ENV,
  });
});

// --- Context Tree (sysuser only) ---

systemRoutes.get("/system/context-tree", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  function buildTree(dir: string, depth = 0): unknown[] {
    if (!existsSync(dir) || depth > 4) return [];
    const items: unknown[] = [];
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;
        if (entry.isDirectory()) {
          items.push({
            name: entry.name,
            type: "directory",
            children: buildTree(join(dir, entry.name), depth + 1),
          });
        } else {
          items.push({ name: entry.name, type: "file" });
        }
      }
    } catch {
      // permission errors
    }
    return items;
  }

  return c.json({ root: CONTEXT_DIR, tree: buildTree(CONTEXT_DIR) });
});

// --- Active Processes (sysuser only) ---

systemRoutes.get("/system/processes", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const agents = listAgents();
  const heartbeat = getHeartbeatStatus();
  const processes: unknown[] = [];

  for (const agent of agents) {
    const hb = heartbeat[agent.id];
    if (hb?.running) {
      processes.push({
        type: "heartbeat",
        agentId: agent.id,
        status: "running",
      });
    }
  }

  return c.json(processes);
});

// --- Refresh Registries (sysuser only) ---

systemRoutes.post("/system/refresh", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const { refreshAgentRegistry } = await import("../agents/registry.js");
  const { refreshChannelRegistry } = await import("../channels/registry.js");

  refreshAgentRegistry();
  refreshChannelRegistry();

  return c.json({
    status: "refreshed",
    agents: listAgents().length,
    channels: listChannels().length,
  });
});

// --- Context File Operations (sysuser only) ---

systemRoutes.get("/system/context/*", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const filePath = c.req.path.replace(/^\/system\/context\//, "");
  const fullPath = join(CONTEXT_DIR, filePath);

  if (!existsSync(fullPath)) {
    return c.json({ error: "not found" }, 404);
  }

  try {
    const content = readFileSync(fullPath, "utf-8");
    return c.json({ path: filePath, content });
  } catch {
    return c.json({ error: "read error" }, 500);
  }
});
