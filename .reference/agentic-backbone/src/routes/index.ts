import { Hono } from "hono";
import { verifyJwt } from "@cia-auth/core";
import { authPublicRoutes, authProtectedRoutes } from "./auth.js";
import { systemRoutes } from "./system.js";
import { agentRoutes } from "./agents.js";
import { channelRoutes } from "./channels.js";
import { skillRoutes } from "./skills.js";
import { toolRoutes } from "./tools.js";
import { adapterRoutes } from "./adapters.js";
import { conversationRoutes } from "./conversations.js";
import { userRoutes } from "./users.js";
import { settingsRoutes } from "./settings.js";
import { cronRoutes } from "./cron.js";
import { jobRoutes } from "./jobs.js";
import { serviceRoutes } from "./services.js";
import { transcribeRoutes } from "./transcribe.js";
import { webhookRoutes } from "./webhooks.js";
import { getHeartbeatStatus } from "../heartbeat/index.js";
import { listAgents } from "../agents/registry.js";
import { listChannels } from "../channels/registry.js";
import { sseHub } from "../events/sse.js";
import { getModuleHealth } from "../modules/loader.js";

export const routes = new Hono();

// ── Public routes ──────────────────────────────────────────

routes.get("/health", async (c) => {
  // Check Whisper availability (3s timeout)
  let whisper: { available: boolean; model?: string } = { available: false };
  const whisperUrl = process.env.WHISPER_URL;
  if (whisperUrl) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${whisperUrl}/health`, { signal: controller.signal });
      clearTimeout(timer);
      whisper = { available: res.ok, model: process.env.WHISPER_MODEL };
    } catch {
      whisper = { available: false };
    }
  }

  return c.json({
    status: "ok",
    whisper,
    heartbeat: getHeartbeatStatus(),
    agents: listAgents().map((a) => ({
      id: a.id,
      heartbeat: a.heartbeat.enabled,
    })),
    channels: listChannels().map((ch) => ({
      slug: ch.slug,
      type: ch.type,
      listeners: sseHub.getClientCount(ch.slug),
    })),
    modules: getModuleHealth(),
  });
});

routes.route("/", authPublicRoutes);
routes.route("/", webhookRoutes);

// ── JWT middleware barrier ──────────────────────────────────
// Supports both Authorization header and ?token= query param (for EventSource)
// Hybrid auth: accepts both Laravel JWT (role_id + unidades) and Backbone JWT (role)

routes.use("*", async (c, next) => {
  const secret = process.env.JWT_SECRET!;

  // Try Authorization header first
  const authHeader = c.req.header("Authorization");
  let token: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }

  // Fall back to ?token= query param (EventSource cannot send headers)
  if (!token) {
    token = c.req.query("token") ?? undefined;
  }

  if (!token) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const result = verifyJwt(token, secret);
  if (!result) {
    return c.json({ error: "invalid or expired token" }, 401);
  }

  const payload = result.payload;

  // Detect JWT type and normalize to Backbone's canonical format
  if (payload.role_id !== undefined && payload.unidades !== undefined) {
    // Laravel JWT — map to Backbone context
    // role_id === 1 (Administrador) → sysuser, all others → user
    const role = payload.role_id === 1 ? "sysuser" : "user";
    c.set("jwtPayload", {
      ...payload,
      role,
      jwtSource: "laravel",
    });
  } else {
    // Backbone JWT (including backbone-internal) — use as-is
    c.set("jwtPayload", {
      ...payload,
      jwtSource: "backbone",
    });
  }

  await next();
});

// ── Protected routes ───────────────────────────────────────

routes.route("/", authProtectedRoutes);
routes.route("/", systemRoutes);
routes.route("/", agentRoutes);
routes.route("/", channelRoutes);
routes.route("/", skillRoutes);
routes.route("/", toolRoutes);
routes.route("/", adapterRoutes);
routes.route("/", conversationRoutes);
routes.route("/", userRoutes);
routes.route("/", settingsRoutes);
routes.route("/", cronRoutes);
routes.route("/", jobRoutes);
routes.route("/", serviceRoutes);
routes.route("/", transcribeRoutes);
