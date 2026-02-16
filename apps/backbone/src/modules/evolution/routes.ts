import { Hono, type Context } from "hono";
import type { EvolutionProbe } from "./probe.js";
import type { EvolutionStateTracker } from "./state.js";
import type { EvolutionActions, ActionResult } from "./actions.js";

interface RouteDeps {
  probe: EvolutionProbe;
  state: EvolutionStateTracker;
  actions: EvolutionActions;
}

/**
 * Creates the Evolution module Hono sub-app with monitoring routes.
 *
 * Mounted at /modules/evolution/ by the module loader.
 *
 * Routes:
 *   GET  /health                     — API state + last probe + response time
 *   GET  /instances                  — all instances with state + duration
 *   GET  /instances/:name            — single instance detail
 *   POST /instances/:name/reconnect  — reconnect action (retry policy)
 *   POST /instances/:name/restart    — restart action (retry policy)
 */
export function createEvolutionRoutes(deps: RouteDeps): Hono {
  const app = new Hono();

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

  return app;
}

/**
 * Maps an ActionResult to the appropriate HTTP response.
 *
 * - cooldown_active → 429
 * - retries_exhausted → 409
 * - other errors → 502
 * - success → 200
 */
function actionResultToResponse(c: Context, result: ActionResult): Response {
  if (result.ok) {
    return c.json({ ok: true });
  }

  if (result.error === "cooldown_active") {
    return c.json(
      { error: "cooldown_active", retryAfterMs: result.retryAfterMs },
      429,
    );
  }

  if (result.error === "retries_exhausted") {
    return c.json(
      { error: "retries_exhausted", attempts: result.attempts, maxRetries: result.maxRetries },
      409,
    );
  }

  return c.json({ error: result.error }, 502);
}
