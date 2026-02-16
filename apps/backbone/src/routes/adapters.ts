import { Hono } from "hono";
import {
  listAdapters,
  getAdapter,
  updateAdapterConfig,
  deleteAdapterConfig,
  testAdapterConnection,
} from "../adapters/manager.js";

export const adapterRoutes = new Hono();

// --- List Adapters ---

adapterRoutes.get("/adapters", (c) => {
  return c.json(listAdapters());
});

// --- Get Adapter Detail ---

adapterRoutes.get("/adapters/:scope/:slug", (c) => {
  const scope = c.req.param("scope");
  const slug = c.req.param("slug");
  const adapter = getAdapter(scope, slug);
  if (!adapter) return c.json({ error: "not found" }, 404);
  return c.json(adapter);
});

// --- Update Adapter ---

adapterRoutes.patch("/adapters/:scope/:slug", async (c) => {
  const scope = c.req.param("scope");
  const slug = c.req.param("slug");
  const body = await c.req.json();
  try {
    const adapter = updateAdapterConfig(scope, slug, body);
    return c.json(adapter);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 404);
  }
});

// --- Delete Adapter ---

adapterRoutes.delete("/adapters/:scope/:slug", (c) => {
  const scope = c.req.param("scope");
  const slug = c.req.param("slug");
  const deleted = deleteAdapterConfig(scope, slug);
  if (!deleted) return c.json({ error: "not found" }, 404);
  return c.json({ status: "deleted" });
});

// --- Test Connection ---

adapterRoutes.post("/adapters/:scope/:slug/test", async (c) => {
  const scope = c.req.param("scope");
  const slug = c.req.param("slug");
  const result = await testAdapterConnection(scope, slug);
  return c.json(result);
});
