import { Hono } from "hono";
import { verify } from "hono/jwt";
import { authPublicRoutes, authProtectedRoutes } from "./auth.js";
import { systemRoutes } from "./system.js";
import { agentRoutes } from "./agents.js";
import { channelRoutes } from "./channels.js";
import { skillRoutes } from "./skills.js";
import { connectorAdapterRoutes } from "./adapters.js";
import { conversationRoutes } from "./conversations.js";
import { userRoutes } from "./users.js";
import { settingsRoutes } from "./settings.js";
import { cronRoutes } from "./cron.js";
import { jobRoutes } from "./jobs.js";
import { notificationRoutes } from "./notifications.js";
import { serviceRoutes } from "./services.js";
import { channelAdapterRoutes } from "./channel-adapters.js";
import { costRoutes } from "./costs.js";
import { analyticsRoutes } from "./analytics.js";
import { traceRoutes } from "./traces.js";
import { knowledgeRoutes } from "./knowledge.js";
import { templateRoutes } from "./templates.js";
import { evaluationRoutes } from "./evaluation.js";
import { approvalRoutes } from "./approvals.js";
import { feedbackRoutes } from "./feedback.js";
import { securityRoutes } from "./security.js";
import { inboxRoutes } from "./inbox.js";
import { webhookRoutes } from "./webhooks.js";
import { lgpdRoutes } from "./lgpd.js";
import { handoffRoutes } from "./handoffs.js";
import { quotaRoutes } from "./quotas.js";
import { versionRoutes } from "./versions.js";
import { draftRoutes } from "./drafts.js";
import { ratingRoutes } from "./ratings.js";
import { workflowRoutes } from "./workflows.js";
import { mcpRoutes } from "./mcp.js";
import { emailRoutes } from "./email.js";
import { routingRoutes } from "./routing.js";
import { benchmarkRoutes } from "./benchmarks.js";
import { initMcpServerRoutes } from "../mcp-server/index.js";
import { getHeartbeatStatus } from "../heartbeat/index.js";
import { listAgents } from "../agents/registry.js";
import { listChannels } from "../channels/registry.js";
import { sseHub } from "../events/sse.js";
import { connectorRegistry } from "../connectors/index.js";

export const routes = new Hono();

// ── Public routes ──────────────────────────────────────────

routes.get("/health", (c) =>
  c.json({
    status: "ok",
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
    connectors: connectorRegistry.healthAll(),
  })
);

routes.route("/", authPublicRoutes);

// ── JWT middleware barrier ──────────────────────────────────
// Supports both Authorization header and ?token= query param (for EventSource)
// Hybrid auth: accepts both Laravel JWT (role_id + unidades) and Backbone JWT (role)

routes.use("*", async (c, next) => {
  // Skip auth for module webhook callbacks (external services can't send JWT)
  const path = new URL(c.req.url).pathname;
  if (path.includes("/webhook")) {
    return next();
  }

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

  try {
    const payload = await verify(token, secret, "HS256");

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
  } catch {
    return c.json({ error: "invalid or expired token" }, 401);
  }
});

// ── Protected routes ───────────────────────────────────────

routes.route("/", authProtectedRoutes);
routes.route("/", systemRoutes);
routes.route("/", agentRoutes);
routes.route("/", channelRoutes);
routes.route("/", skillRoutes);
routes.route("/", connectorAdapterRoutes);
routes.route("/", conversationRoutes);
routes.route("/", userRoutes);
routes.route("/", settingsRoutes);
routes.route("/", cronRoutes);
routes.route("/", jobRoutes);
routes.route("/", notificationRoutes);
routes.route("/", serviceRoutes);
routes.route("/", channelAdapterRoutes);
routes.route("/", costRoutes);
routes.route("/", analyticsRoutes);
routes.route("/", traceRoutes);
routes.route("/", knowledgeRoutes);
routes.route("/", templateRoutes);
routes.route("/", evaluationRoutes);
routes.route("/", approvalRoutes);
routes.route("/", feedbackRoutes);
routes.route("/", securityRoutes);
routes.route("/", inboxRoutes);
routes.route("/", webhookRoutes);
routes.route("/", lgpdRoutes);
routes.route("/", handoffRoutes);
routes.route("/", quotaRoutes);
routes.route("/", versionRoutes);
routes.route("/", draftRoutes);
routes.route("/", ratingRoutes);
routes.route("/", workflowRoutes);
routes.route("/", mcpRoutes);
routes.route("/", emailRoutes);
routes.route("/", routingRoutes);
routes.route("/", benchmarkRoutes);

// MCP Server — registers GET /mcp/sse + POST /mcp/message directly on routes
initMcpServerRoutes(routes);
