import { Hono, type Context } from "hono";
import type { EvolutionProbe } from "./probe.js";
import type { EvolutionStateTracker } from "./state.js";
import type { EvolutionActions, ActionResult } from "./actions.js";

interface RouteDeps {
  probe: EvolutionProbe;
  state: EvolutionStateTracker;
  actions: EvolutionActions;
  env: Record<string, string | undefined>;
}

/**
 * Creates the Evolution module Hono sub-app with monitoring and CRUD routes.
 *
 * Mounted at /modules/evolution/ by the module loader.
 *
 * Monitoring:
 *   GET  /health                      — API state + last probe + response time
 *   GET  /instances                   — all instances with state + duration
 *   GET  /instances/:name             — single instance detail
 *   POST /instances/:name/reconnect   — reconnect action (retry policy)
 *   POST /instances/:name/restart     — restart action (retry policy)
 *
 * CRUD + QR (proxy to Evolution API):
 *   POST   /instances                 — create instance
 *   DELETE /instances/:name           — delete instance
 *   GET    /instances/:name/qr        — get QR code (base64)
 *   GET    /instances/:name/settings  — get instance settings
 *   PATCH  /instances/:name/settings  — update instance settings
 */
export function createEvolutionRoutes(deps: RouteDeps): Hono {
  const app = new Hono();
  const baseUrl = deps.env.EVOLUTION_URL!;
  const apiKey = deps.env.EVOLUTION_API_KEY!;

  // --- GET /health ---

  app.get("/health", (c) => {
    const apiState = deps.probe.getState();
    const lastProbe = deps.probe.getLastProbe();

    return c.json({
      apiState,
      lastProbe: lastProbe
        ? {
            timestamp: lastProbe.timestamp,
            status: lastProbe.status,
            responseTimeMs: lastProbe.responseTimeMs,
            error: lastProbe.error,
          }
        : null,
    });
  });

  // --- GET /instances ---

  app.get("/instances", (c) => {
    const apiState = deps.probe.getState();

    if (apiState === "offline") {
      return c.json({ error: "api_offline" }, 503);
    }

    const instances = deps.state.getInstances();
    return c.json(instances);
  });

  // --- GET /instances/:name ---

  app.get("/instances/:name", (c) => {
    const name = c.req.param("name");
    const apiState = deps.probe.getState();

    if (apiState === "offline") {
      return c.json({ error: "api_offline" }, 503);
    }

    const instance = deps.state.getInstance(name);
    if (!instance) {
      return c.json({ error: "instance_not_found" }, 404);
    }

    return c.json(instance);
  });

  // --- POST /instances/:name/reconnect ---

  app.post("/instances/:name/reconnect", async (c) => {
    const name = c.req.param("name");

    const apiState = deps.probe.getState();
    if (apiState === "offline") {
      return c.json({ error: "api_offline" }, 503);
    }

    const instance = deps.state.getInstance(name);
    if (!instance) {
      return c.json({ error: "instance_not_found" }, 404);
    }

    const result = await deps.actions.reconnect(name);
    return actionResultToResponse(c, result);
  });

  // --- POST /instances/:name/restart ---

  app.post("/instances/:name/restart", async (c) => {
    const name = c.req.param("name");

    const apiState = deps.probe.getState();
    if (apiState === "offline") {
      return c.json({ error: "api_offline" }, 503);
    }

    const instance = deps.state.getInstance(name);
    if (!instance) {
      return c.json({ error: "instance_not_found" }, 404);
    }

    const result = await deps.actions.restart(name);
    return actionResultToResponse(c, result);
  });

  // --- POST /instances (create) ---

  app.post("/instances", async (c) => {
    const apiState = deps.probe.getState();
    if (apiState === "offline") {
      return c.json({ error: "api_offline" }, 503);
    }

    const body = await c.req.json<{ instanceName: string }>();
    if (!body.instanceName) {
      return c.json({ error: "instance_name_required" }, 400);
    }

    try {
      const response = await fetch(`${baseUrl}/instance/create`, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: body.instanceName,
          integration: "WHATSAPP-BAILEYS",
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
        return c.json({ error: "create_failed", details: err }, response.status as 400);
      }

      const data = await response.json();
      // Invalidate module state cache so new instance appears immediately
      void deps.probe.forceTick();
      return c.json(data, 201);
    } catch (err) {
      return c.json({ error: "create_failed", details: String(err) }, 502);
    }
  });

  // --- DELETE /instances/:name ---

  app.delete("/instances/:name", async (c) => {
    const name = c.req.param("name");

    const apiState = deps.probe.getState();
    if (apiState === "offline") {
      return c.json({ error: "api_offline" }, 503);
    }

    try {
      const response = await fetch(`${baseUrl}/instance/delete/${name}`, {
        method: "DELETE",
        headers: { apikey: apiKey },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
        return c.json({ error: "delete_failed", details: err }, response.status as 400);
      }

      const data = await response.json().catch(() => ({ ok: true }));
      // Invalidate module state cache so removed instance disappears immediately
      void deps.probe.forceTick();
      return c.json(data);
    } catch (err) {
      return c.json({ error: "delete_failed", details: String(err) }, 502);
    }
  });

  // --- GET /instances/:name/qr ---

  app.get("/instances/:name/qr", async (c) => {
    const name = c.req.param("name");

    const apiState = deps.probe.getState();
    if (apiState === "offline") {
      return c.json({ error: "api_offline" }, 503);
    }

    try {
      const response = await fetch(`${baseUrl}/instance/connect/${name}`, {
        method: "GET",
        headers: { apikey: apiKey },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
        return c.json({ error: "qr_failed", details: err }, response.status as 400);
      }

      const data = await response.json();
      return c.json(data);
    } catch (err) {
      return c.json({ error: "qr_failed", details: String(err) }, 502);
    }
  });

  // --- GET /instances/:name/settings ---

  app.get("/instances/:name/settings", async (c) => {
    const name = c.req.param("name");

    const apiState = deps.probe.getState();
    if (apiState === "offline") {
      return c.json({ error: "api_offline" }, 503);
    }

    try {
      const response = await fetch(`${baseUrl}/settings/find/${name}`, {
        method: "GET",
        headers: { apikey: apiKey },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
        return c.json({ error: "settings_fetch_failed", details: err }, response.status as 400);
      }

      const data = await response.json();
      return c.json(data);
    } catch (err) {
      return c.json({ error: "settings_fetch_failed", details: String(err) }, 502);
    }
  });

  // --- PATCH /instances/:name/settings ---

  app.patch("/instances/:name/settings", async (c) => {
    const name = c.req.param("name");

    const apiState = deps.probe.getState();
    if (apiState === "offline") {
      return c.json({ error: "api_offline" }, 503);
    }

    const settings = await c.req.json();

    try {
      const response = await fetch(`${baseUrl}/settings/set/${name}`, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
        return c.json({ error: "settings_update_failed", details: err }, response.status as 400);
      }

      const data = await response.json();
      return c.json(data);
    } catch (err) {
      return c.json({ error: "settings_update_failed", details: String(err) }, 502);
    }
  });

  return app;
}

// --- Response envelope helpers ---

function ok<T>(c: Context, data: T) {
  return c.json({ ok: true, data });
}

function fail(c: Context, error: string, details?: unknown, extra?: Record<string, unknown>) {
  return c.json({ ok: false, error, details, ...extra });
}

async function proxyGet<T>(c: Context, url: string, apiKey: string, errorCode: string) {
  try {
    const response = await fetch(url, { headers: { apikey: apiKey } });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
      return fail(c, errorCode, err);
    }
    const data = await response.json() as T;
    return ok(c, data);
  } catch (err) {
    return fail(c, "network_error", String(err));
  }
}

/**
 * Maps an ActionResult to the appropriate HTTP 200 response with envelope.
 *
 * All scenarios return HTTP 200 — business errors are represented in the body.
 */
function actionResultToResponse(c: Context, result: ActionResult): Response {
  if (result.ok) {
    return ok(c, { ok: true });
  }

  if (result.error === "cooldown_active") {
    return fail(c, "cooldown_active", undefined, {
      retryAfterMs: result.retryAfterMs,
    });
  }

  if (result.error === "retries_exhausted") {
    return fail(c, "retries_exhausted", undefined, {
      attempts: result.attempts,
      maxRetries: result.maxRetries,
    });
  }

  return fail(c, result.error ?? "action_failed");
}
