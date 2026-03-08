import { Hono } from "hono";
import { requireSysuser } from "./auth-helpers.js";
import { getActivePlan, listPlans, setActivePlan } from "../settings/llm.js";
import { loadWebSearchConfig, saveWebSearchConfig, isValidWebSearchProvider } from "../settings/web-search.js";
import { loadMcpServerConfig, saveMcpServerConfig, type McpServerConfig } from "../settings/mcp-server.js";

export const settingsRoutes = new Hono();

// --- GET /settings/llm ---

settingsRoutes.get("/settings/llm", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const active = getActivePlan();
  const all = listPlans();
  return c.json({ activePlan: active.name, plans: all });
});

// --- PATCH /settings/llm ---

settingsRoutes.patch("/settings/llm", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const body = await c.req.json<{ activePlan?: string }>();

  if (!body.activePlan) {
    return c.json({ error: "'activePlan' is required" }, 400);
  }

  try {
    setActivePlan(body.activePlan);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 404);
  }

  const active = getActivePlan();
  const all = listPlans();
  return c.json({ activePlan: active.name, plans: all });
});

// --- GET /settings/web-search ---

settingsRoutes.get("/settings/web-search", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  return c.json(loadWebSearchConfig());
});

// --- PATCH /settings/web-search ---

settingsRoutes.patch("/settings/web-search", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const body = await c.req.json<{ provider?: string }>();

  if (!body.provider) {
    return c.json({ error: "'provider' is required" }, 400);
  }

  if (!isValidWebSearchProvider(body.provider)) {
    return c.json({ error: `invalid provider "${body.provider}". Valid: duckduckgo, brave, none` }, 400);
  }

  const config = { provider: body.provider };
  saveWebSearchConfig(config);
  return c.json(config);
});

// --- GET /settings/mcp-server ---

settingsRoutes.get("/settings/mcp-server", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  return c.json(loadMcpServerConfig());
});

// --- PUT /settings/mcp-server ---

settingsRoutes.put("/settings/mcp-server", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const body = await c.req.json<Partial<McpServerConfig>>();

  const current = loadMcpServerConfig();
  const updated: McpServerConfig = {
    enabled: body.enabled ?? current.enabled,
    allowed_agents: body.allowed_agents ?? current.allowed_agents,
    require_auth: body.require_auth ?? current.require_auth,
  };

  saveMcpServerConfig(updated);
  return c.json(updated);
});
