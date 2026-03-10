import { Hono, type Context } from "hono";
import type { BackboneEventBus } from "../../events/index.js";
import type { EvolutionProbe } from "./probe.js";
import type { EvolutionStateTracker } from "./state.js";
import type { EvolutionActions, ActionResult } from "./actions.js";
import { parseEvolutionInbound } from "../../whatsapp/parsers.js";
import { handleInboundMessage } from "../../whatsapp/inbound.js";

interface RouteDeps {
  probe: EvolutionProbe;
  state: EvolutionStateTracker;
  actions: EvolutionActions;
  eventBus: BackboneEventBus;
  log: (msg: string) => void;
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
      return fail(c, "api_offline");
    }

    const instances = deps.state.getInstances();
    return ok(c, instances);
  });

  // --- GET /instances/:name ---

  app.get("/instances/:name", (c) => {
    const name = c.req.param("name");
    const apiState = deps.probe.getState();

    if (apiState === "offline") {
      return fail(c, "api_offline");
    }

    const instance = deps.state.getInstance(name);
    if (!instance) {
      return fail(c, "instance_not_found");
    }

    return ok(c, instance);
  });

  // --- POST /instances/:name/reconnect ---

  app.post("/instances/:name/reconnect", async (c) => {
    const name = c.req.param("name");

    const apiState = deps.probe.getState();
    if (apiState === "offline") {
      return fail(c, "api_offline");
    }

    const instance = deps.state.getInstance(name);
    if (!instance) {
      return fail(c, "instance_not_found");
    }

    const result = await deps.actions.reconnect(name);
    if (result.ok) {
      deps.state.markTransitional(name, "reconnecting");
    }
    return actionResultToResponse(c, result);
  });

  // --- POST /instances/:name/restart ---

  app.post("/instances/:name/restart", async (c) => {
    const name = c.req.param("name");

    const apiState = deps.probe.getState();
    if (apiState === "offline") {
      return fail(c, "api_offline");
    }

    const instance = deps.state.getInstance(name);
    if (!instance) {
      return fail(c, "instance_not_found");
    }

    const result = await deps.actions.restart(name);
    if (result.ok) {
      deps.state.markTransitional(name, "restarting");
    }
    return actionResultToResponse(c, result);
  });

  // --- POST /instances (create) ---

  app.post("/instances", async (c) => {
    const apiState = deps.probe.getState();
    if (apiState === "offline") {
      return fail(c, "api_offline");
    }

    const body = await c.req.json<{ instanceName: string }>();
    if (!body.instanceName) {
      return fail(c, "instance_name_required");
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
        return fail(c, "create_failed", err);
      }

      const data = await response.json();
      // Normalize v2 nested create response to canonical InstanceState shape
      const instance = data?.instance
        ? {
            instanceName: data.instance.instanceName ?? data.instance.name,
            instanceId: data.instance.instanceId ?? data.instance.id,
            state: "close" as const,
            owner: data.instance.ownerJid ?? null,
            profileName: data.instance.profileName ?? null,
          }
        : data;
      // Await probe so StateTracker is updated before the Hub refetches
      await deps.probe.forceTick();
      return ok(c, instance);
    } catch (err) {
      return fail(c, "create_failed", String(err));
    }
  });

  // --- DELETE /instances/:name ---

  app.delete("/instances/:name", async (c) => {
    const name = c.req.param("name");

    const apiState = deps.probe.getState();
    if (apiState === "offline") {
      return fail(c, "api_offline");
    }

    const instance = deps.state.getInstance(name);
    if (!instance) {
      return fail(c, "instance_not_found");
    }

    // Mark transitional before calling Evolution API (immediate SSE feedback)
    deps.state.markTransitional(name, "deleting");

    try {
      const response = await fetch(`${baseUrl}/instance/delete/${name}`, {
        method: "DELETE",
        headers: { apikey: apiKey },
      });

      if (!response.ok) {
        // Revert transitional state on API failure
        deps.state.revertTransitional(name);
        const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
        return fail(c, "delete_failed", err);
      }

      const data = await response.json().catch(() => null);
      // Probe will reconcile: when instance disappears → instance-removed
      return ok(c, data);
    } catch (err) {
      deps.state.revertTransitional(name);
      return fail(c, "delete_failed", String(err));
    }
  });

  // --- GET /instances/:name/qr ---

  app.get("/instances/:name/qr", async (c) => {
    const name = c.req.param("name");

    const apiState = deps.probe.getState();
    if (apiState === "offline") {
      return fail(c, "api_offline");
    }

    try {
      const response = await fetch(`${baseUrl}/instance/connect/${name}`, {
        headers: { apikey: apiKey },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
        return fail(c, "qr_unavailable", err);
      }
      const data = await response.json() as Record<string, unknown>;
      // Evolution returns { base64, code, ... } when QR is ready, { count: 0 } otherwise
      if (!data.base64) {
        return fail(c, "qr_unavailable", { reason: "QR not generated yet" });
      }
      return ok(c, data);
    } catch (err) {
      return fail(c, "network_error", String(err));
    }
  });

  // --- GET /instances/:name/settings ---

  app.get("/instances/:name/settings", async (c) => {
    const name = c.req.param("name");

    const apiState = deps.probe.getState();
    if (apiState === "offline") {
      return fail(c, "api_offline");
    }

    return proxyGet(c, `${baseUrl}/settings/find/${name}`, apiKey, "settings_fetch_failed");
  });

  // --- PATCH /instances/:name/settings ---

  app.patch("/instances/:name/settings", async (c) => {
    const name = c.req.param("name");

    const apiState = deps.probe.getState();
    if (apiState === "offline") {
      return fail(c, "api_offline");
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
        return fail(c, "settings_update_failed", err);
      }

      const data = await response.json();
      return ok(c, data);
    } catch (err) {
      return fail(c, "settings_update_failed", String(err));
    }
  });

  // --- POST /webhook (Evolution API webhook receiver) ---

  const WEBHOOK_EVENT_MAP: Record<string, string> = {
    "messages.upsert": "message-received",
    "qrcode.updated": "qrcode-updated",
    "connection.update": "connection-updated",
  };

  app.post("/webhook", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body) {
      return c.json({ ok: true }); // malformed payload — ack silently
    }

    const event = body.event as string | undefined;
    const instance = body.instance as string | undefined;
    const data = body.data as Record<string, unknown> | undefined;

    // Respond 200 immediately — process in background
    const response = c.json({ ok: true });

    // Background processing
    const busEvent = event ? WEBHOOK_EVENT_MAP[event] : undefined;
    if (busEvent) {
      const phone = (data?.key as Record<string, unknown> | undefined)?.remoteJid as string | undefined;
      deps.log(`webhook: ${event} from ${instance ?? "unknown"}${phone ? ` (${phone})` : ""}`);
      deps.eventBus.emitModule("evolution", busEvent, {
        ts: Date.now(),
        event,
        instance,
        data,
      });

      // Funil unificado: emitir whatsapp:message-received para messages.upsert
      if (event === "messages.upsert") {
        const inbound = parseEvolutionInbound(body as Record<string, unknown>);
        if (inbound) {
          handleInboundMessage(inbound, deps.eventBus);
        }
      }
    } else if (event) {
      deps.log(`webhook: ${event} from ${instance ?? "unknown"} (unhandled)`);
    }

    return response;
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
    return ok(c, null);
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
