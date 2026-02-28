import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { listAgents, getAgent } from "../agents/registry.js";
import {
  createAgent,
  updateAgent,
  deleteAgent,
  duplicateAgent,
  readAgentFile,
  writeAgentFile,
  listAgentFiles,
} from "../agents/manager.js";
import {
  getHeartbeatStatus,
  updateHeartbeatAgent,
  triggerManualHeartbeat,
} from "../heartbeat/index.js";
import { getHeartbeatHistory, getHeartbeatStats } from "../heartbeat/log.js";
import { getAgentMemoryManager } from "../memory/manager.js";
import { loadAllSkills } from "../skills/loader.js";
import { loadAgentTools } from "../tools/loader.js";
import { loadAgentServices, findService } from "../services/loader.js";
import { executeServiceDirect } from "../services/executor.js";
import { assemblePrompt } from "../context/index.js";
import { runAgent } from "../agent/index.js";
import { getAuthUser, filterByOwner, assertOwnership } from "./auth-helpers.js";

export const agentRoutes = new Hono();

function assertAgentOwnership(
  c: Parameters<typeof getAuthUser>[0],
  agentId: string
): Response | null {
  const agent = getAgent(agentId);
  if (!agent) return c.json({ error: "not found" }, 404);
  return assertOwnership(c, agent.owner);
}

// --- List Agents ---

agentRoutes.get("/agents", (c) => {
  const auth = getAuthUser(c);
  return c.json(filterByOwner(listAgents(), auth));
});

// --- Get Agent ---

agentRoutes.get("/agents/:id", (c) => {
  const agent = getAgent(c.req.param("id"));
  if (!agent) return c.json({ error: "not found" }, 404);
  const denied = assertOwnership(c, agent.owner);
  if (denied) return denied;
  return c.json(agent);
});

// --- Create Agent ---

agentRoutes.post("/agents", async (c) => {
  const auth = getAuthUser(c);
  const body = await c.req.json();
  // Force owner for regular users
  if (auth.role !== "sysuser") {
    body.owner = auth.user;
  }
  try {
    const agent = createAgent(body);
    return c.json(agent, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// --- Update Agent ---

agentRoutes.patch("/agents/:id", async (c) => {
  const id = c.req.param("id");
  const denied = assertAgentOwnership(c, id);
  if (denied) return denied;
  const body = await c.req.json();
  try {
    const agent = updateAgent(id, body);

    // Sync heartbeat scheduler when enabled changes
    if (body.enabled !== undefined) {
      if (agent.enabled && agent.heartbeat.enabled) {
        updateHeartbeatAgent(id, agent.heartbeat);
      } else {
        updateHeartbeatAgent(id, { ...agent.heartbeat, enabled: false });
      }
    }

    return c.json(agent);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 404);
  }
});

// --- Delete Agent ---

agentRoutes.delete("/agents/:id", (c) => {
  const id = c.req.param("id");
  const denied = assertAgentOwnership(c, id);
  if (denied) return denied;
  const deleted = deleteAgent(id);
  if (!deleted) return c.json({ error: "not found" }, 404);
  return c.json({ status: "deleted" });
});

// --- Duplicate Agent ---

agentRoutes.post("/agents/:id/duplicate", async (c) => {
  const sourceId = c.req.param("id");
  const denied = assertAgentOwnership(c, sourceId);
  if (denied) return denied;
  const auth = getAuthUser(c);
  const { owner, slug } = await c.req.json<{ owner: string; slug: string }>();
  const effectiveOwner = auth.role === "sysuser" ? owner : auth.user;
  try {
    const agent = duplicateAgent(sourceId, effectiveOwner, slug);
    return c.json(agent, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// --- Agent Files ---

agentRoutes.get("/agents/:id/files", (c) => {
  const id = c.req.param("id");
  const denied = assertAgentOwnership(c, id);
  if (denied) return denied;
  const files = listAgentFiles(id);
  return c.json(files);
});

agentRoutes.get("/agents/:id/files/*", (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;
  const filename = c.req.path.replace(new RegExp(`^/agents/${agentId.replace(".", "\\.")}/files/`), "");
  const content = readAgentFile(agentId, filename);
  if (content === null) return c.json({ error: "not found" }, 404);
  return c.json({ filename, content });
});

agentRoutes.put("/agents/:id/files/*", async (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;
  const filename = c.req.path.replace(new RegExp(`^/agents/${agentId.replace(".", "\\.")}/files/`), "");
  const { content } = await c.req.json<{ content: string }>();
  try {
    writeAgentFile(agentId, filename, content);
    return c.json({ status: "saved" });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// --- Agent Heartbeat ---

agentRoutes.get("/agents/:id/heartbeat", (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;
  const status = getHeartbeatStatus();
  return c.json(status[agentId] ?? { running: false, lastStatus: null });
});

agentRoutes.post("/agents/:id/heartbeat/toggle", async (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;
  const agent = getAgent(agentId);
  if (!agent) return c.json({ error: "not found" }, 404);

  const { enabled } = await c.req.json<{ enabled: boolean }>();
  updateHeartbeatAgent(agentId, { ...agent.heartbeat, enabled });

  // Also update the agent config file
  updateAgent(agentId, { heartbeatEnabled: enabled });

  return c.json({ status: "ok", enabled });
});

agentRoutes.post("/agents/:id/heartbeat/trigger", async (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;
  const agent = getAgent(agentId);
  if (!agent) return c.json({ error: "not found" }, 404);

  triggerManualHeartbeat(agentId).catch((err) =>
    console.error(`[heartbeat:manual] ${agentId} failed:`, err)
  );

  return c.json({ status: "triggered" });
});

agentRoutes.get("/agents/:id/heartbeat/history", (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;
  const limit = Number(c.req.query("limit") ?? 50);
  const offset = Number(c.req.query("offset") ?? 0);
  return c.json(getHeartbeatHistory(agentId, { limit, offset }));
});

agentRoutes.get("/agents/:id/heartbeat/stats", (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;
  return c.json(getHeartbeatStats(agentId));
});

// --- Agent Memory ---

agentRoutes.get("/agents/:id/memory/status", (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;
  const mgr = getAgentMemoryManager(agentId);
  return c.json(mgr.status());
});

agentRoutes.get("/agents/:id/memory/chunks", (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;
  const mgr = getAgentMemoryManager(agentId);
  const limit = Number(c.req.query("limit") ?? 100);
  const offset = Number(c.req.query("offset") ?? 0);
  return c.json(mgr.listChunks({ limit, offset }));
});

agentRoutes.post("/agents/:id/memory/search", async (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;
  const { query, maxResults } = await c.req.json<{ query: string; maxResults?: number }>();
  if (!query) return c.json({ error: "query is required" }, 400);

  const mgr = getAgentMemoryManager(agentId);
  const results = await mgr.search(query, { maxResults });
  return c.json(results);
});

agentRoutes.post("/agents/:id/memory/sync", async (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;
  const mgr = getAgentMemoryManager(agentId);
  await mgr.sync({ force: true });
  return c.json({ status: "synced", ...mgr.status() });
});

agentRoutes.delete("/agents/:id/memory/chunks", async (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;
  const { ids } = await c.req.json<{ ids: number[] }>();
  const mgr = getAgentMemoryManager(agentId);
  const deleted = mgr.deleteChunks(ids);
  return c.json({ deleted });
});

agentRoutes.post("/agents/:id/memory/reset", (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;
  const mgr = getAgentMemoryManager(agentId);
  mgr.resetMemory();
  return c.json({ status: "reset" });
});

// --- Agent Skills ---

agentRoutes.get("/agents/:id/skills", (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;
  const skills = loadAllSkills(agentId);
  return c.json(skills);
});

// --- Agent Tools ---

agentRoutes.get("/agents/:id/tools", (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;
  const tools = loadAgentTools(agentId);
  return c.json(tools);
});

// --- Agent Services ---

agentRoutes.get("/agents/:id/services", (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;
  const services = loadAgentServices(agentId);
  return c.json(services);
});

// --- Agent Request (direct invocation in request mode) ---

agentRoutes.post("/agents/:id/request", async (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;

  const agent = getAgent(agentId);
  if (!agent) return c.json({ error: "not found" }, 404);

  const { prompt: userMessage } = await c.req.json<{ prompt: string }>();
  if (!userMessage) return c.json({ error: "prompt is required" }, 400);

  const assembled = await assemblePrompt(agentId, "request", {
    userMessage,
  });
  if (!assembled) {
    return c.json({ error: "agent has no REQUEST.md instructions" }, 400);
  }

  const wantsSSE = c.req.header("Accept") === "text/event-stream";

  if (wantsSSE) {
    return streamSSE(c, async (stream) => {
      for await (const event of runAgent(assembled, { role: "request" })) {
        await stream.writeSSE({ data: JSON.stringify(event) });
      }
    });
  }

  // JSON synchronous response
  const startMs = Date.now();
  let result = "";
  let usage: unknown;
  for await (const event of runAgent(assembled, { role: "request" })) {
    if (event.type === "result" && event.content) {
      result = event.content;
    } else if (event.type === "text" && event.content) {
      result += event.content;
    } else if (event.type === "usage" && event.usage) {
      usage = event.usage;
    }
  }
  return c.json({ result, usage, durationMs: Date.now() - startMs });
});

// --- Agent Service Invocation ---

agentRoutes.post("/agents/:id/services/:slug", async (c) => {
  const agentId = c.req.param("id");
  const serviceSlug = c.req.param("slug");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;

  const service = findService(agentId, serviceSlug);
  if (!service) {
    return c.json({ error: `service '${serviceSlug}' not found` }, 404);
  }

  const body = await c.req.json().catch(() => ({}));

  // skip-agent: execute directly without LLM
  if (service.skipAgent) {
    const execResult = await executeServiceDirect(service, body);
    return c.json(execResult, execResult.ok ? 200 : 500);
  }

  // LLM-backed service invocation via request mode
  const payload =
    typeof body.prompt === "string" ? body.prompt : JSON.stringify(body);

  const assembled = await assemblePrompt(agentId, "request", {
    userMessage: payload,
  });
  if (!assembled) {
    return c.json({ error: "agent has no REQUEST.md instructions" }, 400);
  }

  const wantsSSE = c.req.header("Accept") === "text/event-stream";

  if (wantsSSE) {
    return streamSSE(c, async (stream) => {
      for await (const event of runAgent(assembled, { role: "request" })) {
        await stream.writeSSE({ data: JSON.stringify(event) });
      }
    });
  }

  const startMs = Date.now();
  let result = "";
  let usage: unknown;
  for await (const event of runAgent(assembled, { role: "request" })) {
    if (event.type === "result" && event.content) {
      result = event.content;
    } else if (event.type === "text" && event.content) {
      result += event.content;
    } else if (event.type === "usage" && event.usage) {
      usage = event.usage;
    }
  }
  return c.json({ result, usage, durationMs: Date.now() - startMs });
});
