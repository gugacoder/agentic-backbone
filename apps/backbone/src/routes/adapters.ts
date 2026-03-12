import { Hono } from "hono";
import { connectorRegistry } from "../connectors/index.js";
import { formatError } from "../utils/errors.js";

export const connectorAdapterRoutes = new Hono();

// --- List Adapters ---

connectorAdapterRoutes.get("/adapters", (c) => {
  return c.json({ adapters: connectorRegistry.listAdapters() });
});

// --- Create Adapter ---

connectorAdapterRoutes.post("/adapters", async (c) => {
  const body = await c.req.json();
  try {
    const { slug, scope, connector, label, policy, credential, options } = body;
    const adapter = connectorRegistry.createAdapter(scope || "shared", slug, {
      connector,
      label,
      policy,
      credential,
      options,
    });
    return c.json(adapter);
  } catch (err) {
    return c.json({ error: formatError(err) }, 400);
  }
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
    return c.json({ error: formatError(err) }, 500);
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

// --- Test Adapter Connection ---

connectorAdapterRoutes.post("/adapters/:slug/test", async (c) => {
  const slug = c.req.param("slug");
  try {
    const result = await connectorRegistry.testAdapter(slug);
    return c.json(result);
  } catch (err) {
    return c.json({ ok: false, error: formatError(err) });
  }
});
