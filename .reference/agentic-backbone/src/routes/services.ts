import { Hono } from "hono";
import {
  invokeService,
  getService,
  listServices,
  killService,
  clearService,
  resolveServiceConfig,
  listAvailableServices,
} from "../services/engine.js";

export const serviceRoutes = new Hono();

// POST /services/:slug — invoke a stateless service
serviceRoutes.post("/services/:slug", async (c) => {
  const { slug } = c.req.param();
  const body = await c.req.json<{
    input?: Record<string, unknown>;
    timeout?: number;
    channel?: string;
    callback?: string;
  }>().catch((): { input?: Record<string, unknown>; timeout?: number; channel?: string; callback?: string } => ({}));

  try {
    const summary = invokeService({
      slug,
      input: body.input,
      timeout: body.timeout,
      channel: body.channel,
      callback: body.callback,
    });
    return c.json(summary, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 500);
  }
});

// GET /services — list available services (from filesystem)
serviceRoutes.get("/services", (c) => {
  const agentId = c.req.query("agentId") ?? undefined;
  return c.json(listAvailableServices(agentId));
});

// GET /services/:slug — get service config (SERVICE.yaml parsed)
serviceRoutes.get("/services/:slug", (c) => {
  const { slug } = c.req.param();
  const config = resolveServiceConfig(slug);
  if (!config) return c.json({ error: "service not found" }, 404);
  return c.json({ slug, config });
});

// GET /services/:slug/runs — list running/finished executions
serviceRoutes.get("/services/:slug/runs", (c) => {
  const { slug } = c.req.param();
  const all = listServices();
  const filtered = all.filter((s) => s.slug === slug);
  return c.json(filtered);
});

// DELETE /services/:slug/runs/:id — kill or clear a service execution
serviceRoutes.delete("/services/:slug/runs/:id", (c) => {
  const { id } = c.req.param();
  const killed = killService(id);
  if (killed) return c.json({ status: "killed" });

  const cleared = clearService(id);
  if (cleared) return c.json({ status: "cleared" });

  return c.json({ error: "not found" }, 404);
});
