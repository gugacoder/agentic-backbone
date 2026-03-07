import { Hono } from "hono";
import { connectorRegistry } from "../connectors/index.js";
import { formatError } from "../utils/errors.js";

export const connectorAdapterRoutes = new Hono();

// --- List Adapters ---

connectorAdapterRoutes.get("/adapters", (c) => {
  return c.json({ adapters: connectorRegistry.listAdapters() });
});

// --- Get Adapter Detail ---

connectorAdapterRoutes.get("/adapters/:slug", (c) => {
  const slug = c.req.param("slug");
  const adapter = connectorRegistry.findAdapterMasked(slug);
  if (!adapter) return c.json({ error: "not found" }, 404);
  return c.json(adapter);
});

// --- Create Adapter ---

connectorAdapterRoutes.post("/adapters", async (c) => {
  const body = await c.req.json<{
    slug: string;
    connector: string;
    scope?: string;
    label?: string;
    policy?: string;
    credential?: Record<string, unknown>;
    options?: Record<string, unknown>;
  }>();

  const scope = (body.scope === "system" ? "system" : "shared") as "shared" | "system";

  try {
    const adapter = connectorRegistry.createAdapter(scope, body.slug, {
      connector: body.connector,
      label: body.label,
      policy: body.policy,
      credential: body.credential,
      options: body.options,
    });
    return c.json(adapter, 201);
  } catch (err) {
    return c.json({ error: formatError(err) }, 400);
  }
});

// --- Update Adapter ---

connectorAdapterRoutes.patch("/adapters/:slug", async (c) => {
  const slug = c.req.param("slug");
  const body = await c.req.json<{
    name?: string;
    label?: string;
    description?: string;
    policy?: string;
    credential?: Record<string, unknown>;
    enabled?: boolean;
  }>();

  const adapter = connectorRegistry.findAdapter(slug);
  if (!adapter) return c.json({ error: "not found" }, 404);

  const scope = adapter.source === "system" ? "system" : "shared";

  try {
    const updated = connectorRegistry.updateAdapter(scope, slug, {
      name: body.label ?? body.name,
      description: body.description,
      policy: body.policy,
      params: body.credential,
      enabled: body.enabled,
    });
    return c.json(updated);
  } catch (err) {
    return c.json({ error: formatError(err) }, 500);
  }
});

// --- Delete Adapter ---

connectorAdapterRoutes.delete("/adapters/:slug", (c) => {
  const slug = c.req.param("slug");
  const adapter = connectorRegistry.findAdapter(slug);
  if (!adapter) return c.json({ error: "not found" }, 404);

  const scope = adapter.source === "system" ? "system" : "shared";
  const deleted = connectorRegistry.deleteAdapter(scope, slug);
  if (!deleted) return c.json({ error: "not found" }, 404);
  return c.json({ status: "deleted" });
});

// --- Test Adapter Connection ---

connectorAdapterRoutes.post("/adapters/:slug/test", async (c) => {
  const slug = c.req.param("slug");
  const result = await connectorRegistry.testAdapter(slug);
  const status = result.ok ? 200 : 502;
  return c.json(result, status);
});
