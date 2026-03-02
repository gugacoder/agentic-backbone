import { Hono, type Context } from "hono";
import type { EvolutionProbe } from "./probe.js";
import type { EvolutionStateTracker } from "./state.js";
import type { EvolutionActions, ActionResult } from "./actions.js";
import { findChannelByMetadata } from "../../channels/lookup.js";
import { routeInboundMessage } from "../../channel-adapters/inbound-router.js";

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

      // Registrar webhook para a nova instância
      const callbackHost = deps.env.BACKBONE_CALLBACK_HOST ?? "localhost";
      const backbonePort = deps.env.BACKBONE_PORT;
      const webhookUrl = `http://${callbackHost}:${backbonePort}/api/v1/ai/modules/evolution/webhook`;
      try {
        await fetch(`${baseUrl}/webhook/set/${body.instanceName}`, {
          method: "POST",
          headers: { apikey: apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            webhook: {
              enabled: true,
              url: webhookUrl,
              webhook_by_events: false,
              events: ["MESSAGES_UPSERT"],
            },
          }),
        });
      } catch (webhookErr) {
        console.warn(`[evolution] webhook registration failed for ${body.instanceName}:`, webhookErr);
      }

      // Invalidate module state cache so new instance appears immediately
      void deps.probe.forceTick();
      return ok(c, data);
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

    try {
      const response = await fetch(`${baseUrl}/instance/delete/${name}`, {
        method: "DELETE",
        headers: { apikey: apiKey },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
        return fail(c, "delete_failed", err);
      }

      const data = await response.json().catch(() => null);
      // Invalidate module state cache so removed instance disappears immediately
      void deps.probe.forceTick();
      return ok(c, data);
    } catch (err) {
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

    return proxyGet(c, `${baseUrl}/instance/connect/${name}`, apiKey, "qr_unavailable");
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

  // --- POST /webhook (inbound messages from Evolution) ---

  app.post("/webhook", async (c) => {
    const body = await c.req.json();

    // Evolution webhook payload: { instance, data: { key: { remoteJid }, message: { conversation } }, ... }
    const instanceName = body.instance as string | undefined;
    const remoteJid = body.data?.key?.remoteJid as string | undefined;
    const fromMe = body.data?.key?.fromMe as boolean | undefined;
    const messageText =
      (body.data?.message?.conversation as string) ??
      (body.data?.message?.extendedTextMessage?.text as string) ??
      "";

    if (!instanceName || !remoteJid || !messageText) {
      return c.json({ status: "ignored" }, 200);
    }

    if (fromMe) {
      return c.json({ status: "ignored_self" }, 200);
    }

    if (remoteJid.endsWith("@g.us")) {
      return c.json({ status: "ignored_group" }, 200);
    }

    // Extract sender number from JID (e.g. "5511999999999@s.whatsapp.net" → "5511999999999")
    const senderId = remoteJid.split("@")[0];

    // Lookup channel by instance metadata
    const channel = findChannelByMetadata("instance", instanceName);
    if (!channel) {
      return c.json({ status: "no_channel" }, 200);
    }

    routeInboundMessage(channel.slug, {
      senderId,
      content: messageText,
      ts: Date.now(),
      metadata: { instance: instanceName, remoteJid },
    }).catch((err) => {
      console.error(`[evolution/webhook] routing failed:`, err);
    });

    return c.json({ status: "accepted" }, 200);
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
