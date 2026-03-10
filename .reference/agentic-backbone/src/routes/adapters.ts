import { Hono } from "hono";
import {
  listAdapters,
  getAdapter,
  updateAdapterConfig,
  deleteAdapterConfig,
  testAdapterConnection,
} from "../adapters/manager.js";
import { getBuiltinDef } from "../adapters/builtin.js";

export const adapterRoutes = new Hono();

// --- List Adapters ---

adapterRoutes.get("/adapters", (c) => {
  return c.json(listAdapters());
});

// --- Built-in Adapter Info ---

adapterRoutes.get("/adapters/builtin/:slug", (c) => {
  const slug = c.req.param("slug");
  const def = getBuiltinDef(slug);
  if (!def) return c.json({ error: "not found" }, 404);
  return c.json({
    slug: def.slug,
    name: def.name,
    connector: def.connector,
    policy: def.policy,
    description: def.description,
  });
});

// --- Built-in Adapter PATCH (forbidden) ---

adapterRoutes.patch("/adapters/builtin/:slug", (c) => {
  return c.json({ error: "Built-in adapters cannot be modified" }, 403);
});

// --- Built-in Adapter DELETE (forbidden) ---

adapterRoutes.delete("/adapters/builtin/:slug", (c) => {
  return c.json({ error: "Built-in adapters cannot be deleted" }, 403);
});

// --- Built-in Adapter Test Connection ---

adapterRoutes.post("/adapters/builtin/:slug/test", async (c) => {
  const slug = c.req.param("slug");
  const result = await testAdapterConnection("builtin", slug);
  return c.json(result);
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
    return c.json({ error: (err as Error).message }, 403);
  }
});

// --- Delete Adapter ---

adapterRoutes.delete("/adapters/:scope/:slug", (c) => {
  const scope = c.req.param("scope");
  const slug = c.req.param("slug");
  try {
    const deleted = deleteAdapterConfig(scope, slug);
    if (!deleted) return c.json({ error: "not found" }, 404);
    return c.json({ status: "deleted" });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 403);
  }
});

// --- Test Connection ---

adapterRoutes.post("/adapters/:scope/:slug/test", async (c) => {
  const scope = c.req.param("scope");
  const slug = c.req.param("slug");
  const result = await testAdapterConnection(scope, slug);
  return c.json(result);
});
