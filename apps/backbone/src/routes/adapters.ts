import { Hono } from "hono";
import { connectorRegistry } from "../connectors/index.js";

export const connectorAdapterRoutes = new Hono();

// --- List Adapters ---

connectorAdapterRoutes.get("/adapters", (c) => {
  return c.json(connectorRegistry.listAdapters());
});

// --- Get Adapter Detail ---

connectorAdapterRoutes.get("/adapters/:scope/:slug", (c) => {
  const scope = c.req.param("scope");
  const slug = c.req.param("slug");
  const adapter = connectorRegistry.getAdapter(scope, slug);
  if (!adapter) return c.json({ error: "not found" }, 404);
  return c.json(adapter);
});

// --- Update Adapter ---

connectorAdapterRoutes.patch("/adapters/:scope/:slug", async (c) => {
  const scope = c.req.param("scope");
  const slug = c.req.param("slug");
  const body = await c.req.json();
  try {
    const adapter = connectorRegistry.updateAdapter(scope, slug, body);
    return c.json(adapter);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 404);
  }
});

// --- Delete Adapter ---

connectorAdapterRoutes.delete("/adapters/:scope/:slug", (c) => {
  const scope = c.req.param("scope");
  const slug = c.req.param("slug");
  const deleted = connectorRegistry.deleteAdapter(scope, slug);
  if (!deleted) return c.json({ error: "not found" }, 404);
  return c.json({ status: "deleted" });
});
