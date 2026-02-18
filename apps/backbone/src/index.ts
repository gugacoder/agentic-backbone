// Allow running inside a Claude Code session (nested session guard bypass)
delete process.env.CLAUDECODE;

// ── Validate required env vars ─────────────────────────────
const REQUIRED_ENV = ["JWT_SECRET", "SYSUSER", "SYSPASS", "BACKBONE_PORT"] as const;
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(
    `[backbone] FATAL: missing required env vars: ${missing.join(", ")}`
  );
  process.exit(1);
}

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { routes } from "./routes/index.js";
import { startHeartbeat, stopHeartbeat } from "./heartbeat/index.js";
import { startCron, stopCron } from "./cron/index.js";
import { startWatchers, stopWatchers } from "./watchers/index.js";
import { listAgents } from "./agents/registry.js";
import { listChannels } from "./channels/registry.js";
import { initHooks, wireEventBusToHooks, triggerHook } from "./hooks/index.js";
import { startJobSweeper, stopJobSweeper, shutdownAllJobs } from "./jobs/engine.js";
import { modules } from "./modules/index.js";
import { startModules, stopModules } from "./modules/loader.js";

import type { ServerType } from "@hono/node-server";

let server: ServerType;

const app = new Hono();

async function bootstrap() {
  // Generate internal auth token for agent tools (job submission, etc.)
  const now = Math.floor(Date.now() / 1000);
  const internalToken = await sign(
    { sub: "backbone-internal", role: "sysuser", iat: now, exp: now + 60 * 60 * 24 * 365 },
    process.env.JWT_SECRET!
  );
  process.env.AUTH_TOKEN = internalToken;

  await initHooks();
  wireEventBusToHooks();

  // Modules must be started BEFORE app.route() — Hono copies routes on mount,
  // so routes added after .route() won't propagate to the app.
  await startModules(modules, routes);
  const moduleNames = modules.map((m) => m.name).join(", ") || "(none)";
  console.log(`[backbone] modules: ${moduleNames}`);

  // Mount routes AFTER modules registered their routes on the `routes` Hono instance
  app.route("/api", routes);
  app.route("/", routes);

  // Serve frontend static files when built
  const webDistPath = resolve(process.cwd(), "..", "web", "dist");
  if (existsSync(webDistPath)) {
    console.log(`[backbone] serving frontend from ${webDistPath}`);

    const mimeTypes: Record<string, string> = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
    };

    const indexHtml = readFileSync(join(webDistPath, "index.html"), "utf-8");

    app.get("/*", (c) => {
      // Try to serve the file directly
      const urlPath = new URL(c.req.url).pathname;
      const filePath = join(webDistPath, urlPath);

      try {
        if (existsSync(filePath) && statSync(filePath).isFile()) {
          const ext = extname(filePath);
          const mime = mimeTypes[ext] ?? "application/octet-stream";
          const content = readFileSync(filePath);
          return new Response(content, {
            headers: { "Content-Type": mime },
          });
        }
      } catch {
        // Fall through to SPA fallback
      }

      // SPA fallback: serve index.html
      return c.html(indexHtml);
    });
  }

  const port = Number(process.env.BACKBONE_PORT);

  server = serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[backbone] listening on http://localhost:${info.port}`);

    const agents = listAgents();
    const channels = listChannels();
    console.log(
      `[backbone] agents: ${agents.map((a) => a.id).join(", ") || "(none)"}`
    );
    console.log(
      `[backbone] channels: ${channels.map((c) => c.slug).join(", ") || "(none)"}`
    );

    startHeartbeat();
    startCron();
    startWatchers();
    startJobSweeper();

    triggerHook({
      ts: Date.now(),
      hookEvent: "startup",
      port: info.port,
      agentCount: agents.length,
      channelCount: channels.length,
    }).catch((err) => console.error("[hooks] startup hook failed:", err));
  });
}

bootstrap().catch((err) => {
  console.error("[backbone] FATAL: bootstrap failed", err);
  process.exit(1);
});

// --- Graceful shutdown ---

let shuttingDown = false;

async function onShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[backbone] ${signal} received — shutting down`);

  // Safety timeout — force exit if cleanup hangs
  const forceExit = setTimeout(() => {
    console.error("[backbone] shutdown timed out — forcing exit");
    process.exit(1);
  }, 5_000);
  forceExit.unref();

  try {
    stopHeartbeat();
    stopCron();
    stopWatchers();
    stopJobSweeper();
    shutdownAllJobs();
    await stopModules();

    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  } catch (err) {
    console.error("[backbone] error during shutdown:", err);
  }

  process.exit(0);
}

process.on("SIGTERM", () => onShutdown("SIGTERM"));
process.on("SIGINT", () => onShutdown("SIGINT"));
