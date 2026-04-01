import { Hono } from "hono";
import { requireSysuser } from "./auth-helpers.js";
import { getActivePlan, listPlans, setActivePlan } from "../settings/llm.js";
import { loadWebSearchConfig, saveWebSearchConfig, isValidWebSearchProvider } from "../settings/web-search.js";
import { loadMcpServerConfig, saveMcpServerConfig, type McpServerConfig } from "../settings/mcp-server.js";
import { loadProvidersConfig, saveProvidersConfig } from "../settings/providers.js";
import { loadNgrokConfig, saveNgrokConfig, startNgrok, stopNgrok, getNgrokStatus } from "../ngrok/index.js";
import { loadMenuConfig, saveMenuConfig } from "../settings/menu.js";
import { loadWhisperConfig, saveWhisperConfig } from "../settings/whisper.js";
import { getOtpConfig } from "../settings/otp.js";
import { existsSync } from "node:fs";
import { settingsPath } from "../context/paths.js";
import { readYaml, writeYaml } from "../context/readers.js";

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

// --- GET /settings/providers ---

settingsRoutes.get("/settings/providers", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const config = loadProvidersConfig();

  function maskKey(key?: string): { configured: boolean; preview?: string } {
    if (!key) return { configured: false };
    return { configured: true, preview: key.slice(0, 8) + "..." };
  }

  return c.json({
    openrouter: maskKey(config.openrouter?.api_key),
    openai: maskKey(config.openai?.api_key),
    brave: maskKey(config.brave?.api_key),
    groq: maskKey(config.groq?.api_key),
  });
});

// --- PATCH /settings/providers ---

settingsRoutes.patch("/settings/providers", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const body = await c.req.json<{
    openrouter?: { api_key?: string };
    openai?: { api_key?: string };
    brave?: { api_key?: string };
    groq?: { api_key?: string };
  }>();

  const current = loadProvidersConfig();

  if (body.openrouter !== undefined) {
    current.openrouter = { ...current.openrouter, ...body.openrouter };
  }
  if (body.openai !== undefined) {
    current.openai = { ...current.openai, ...body.openai };
  }
  if (body.brave !== undefined) {
    current.brave = { ...current.brave, ...body.brave };
  }
  if (body.groq !== undefined) {
    current.groq = { ...current.groq, ...body.groq };
  }

  saveProvidersConfig(current);
  return c.json({ ok: true });
});

// --- POST /settings/providers/test/:provider ---

settingsRoutes.post("/settings/providers/test/:provider", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const provider = c.req.param("provider");
  const config = loadProvidersConfig();

  let api_key: string | undefined;
  if (provider === "openrouter") api_key = config.openrouter?.api_key ?? process.env.OPENROUTER_API_KEY;
  else if (provider === "openai") api_key = config.openai?.api_key ?? process.env.OPENAI_API_KEY;
  else if (provider === "brave") api_key = config.brave?.api_key ?? process.env.BRAVE_API_KEY;
  else if (provider === "groq") api_key = config.groq?.api_key ?? process.env.GROQ_API_KEY;
  else return c.json({ error: `Unknown provider: ${provider}` }, 400);

  if (!api_key) {
    return c.json({ ok: false, error: "API key not configured" });
  }

  const start = Date.now();
  try {
    let url: string;
    let headers: Record<string, string>;

    if (provider === "openrouter") {
      url = "https://openrouter.ai/api/v1/models";
      headers = { Authorization: `Bearer ${api_key}` };
    } else if (provider === "openai") {
      url = "https://api.openai.com/v1/models";
      headers = { Authorization: `Bearer ${api_key}` };
    } else if (provider === "groq") {
      url = "https://api.groq.com/openai/v1/models";
      headers = { Authorization: `Bearer ${api_key}` };
    } else {
      url = "https://api.search.brave.com/res/v1/web/search?q=test&count=1";
      headers = { "X-Subscription-Token": api_key };
    }

    const resp = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(8000),
    });

    const latencyMs = Date.now() - start;
    if (resp.ok) {
      return c.json({ ok: true, latencyMs });
    } else {
      return c.json({ ok: false, latencyMs, error: `HTTP ${resp.status}` });
    }
  } catch (err) {
    return c.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// --- GET /settings/infrastructure/whisper ---

settingsRoutes.get("/settings/infrastructure/whisper", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  return c.json(loadWhisperConfig());
});

// --- PATCH /settings/infrastructure/whisper ---

settingsRoutes.patch("/settings/infrastructure/whisper", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const body = await c.req.json<{ model?: string; computeType?: string }>();
  const current = loadWhisperConfig();

  if (body.model !== undefined) current.model = body.model;
  if (body.computeType !== undefined) current.computeType = body.computeType;

  saveWhisperConfig(current);
  return c.json(current);
});

// --- GET /settings/infrastructure/ngrok ---

settingsRoutes.get("/settings/infrastructure/ngrok", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const config = loadNgrokConfig();
  const status = await getNgrokStatus();

  // Mask authtoken
  const safeConfig = {
    domain: config.domain,
    enabled: config.enabled,
    hasAuthtoken: !!config.authtoken,
  };

  return c.json({ config: safeConfig, status });
});

// --- PATCH /settings/infrastructure/ngrok ---

settingsRoutes.patch("/settings/infrastructure/ngrok", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const body = await c.req.json<{ authtoken?: string; domain?: string; enabled?: boolean }>();
  const current = loadNgrokConfig();

  if (body.authtoken !== undefined) current.authtoken = body.authtoken;
  if (body.domain !== undefined) current.domain = body.domain;
  if (body.enabled !== undefined) current.enabled = body.enabled;

  saveNgrokConfig(current);
  return c.json({ ok: true });
});

// --- POST /settings/infrastructure/ngrok/start ---

settingsRoutes.post("/settings/infrastructure/ngrok/start", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const port = Number(process.env.BACKBONE_PORT);
  const status = await startNgrok(port);
  return c.json(status);
});

// --- GET /settings/menu ---

settingsRoutes.get("/settings/menu", (c) => {
  return c.json(loadMenuConfig());
});

// --- PUT /settings/menu ---

settingsRoutes.put("/settings/menu", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const body = await c.req.json<{ contexts?: { main?: Record<string, boolean>; agent?: Record<string, boolean> } }>();
  const current = loadMenuConfig();

  if (body.contexts?.main !== undefined) {
    current.contexts.main = { ...current.contexts.main, ...body.contexts.main };
  }
  if (body.contexts?.agent !== undefined) {
    current.contexts.agent = { ...current.contexts.agent, ...body.contexts.agent };
  }

  saveMenuConfig(current);
  return c.json(current);
});

// --- GET /settings/infrastructure/services ---

settingsRoutes.get("/settings/infrastructure/services", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const whisperPort = process.env.WHISPER_PORT;
  const evolutionPort = process.env.EVOLUTION_PORT;
  const adminerPort = process.env.ADMINER_PORT;

  return c.json({
    whisper: whisperPort ? `http://localhost:${whisperPort}` : null,
    evolution: evolutionPort ? `http://localhost:${evolutionPort}/manager` : null,
    adminer: adminerPort ? `http://localhost:${adminerPort}` : null,
  });
});

// --- POST /settings/infrastructure/ngrok/stop ---

settingsRoutes.post("/settings/infrastructure/ngrok/stop", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  await stopNgrok();
  return c.json({ ok: true });
});

// --- GET /settings/otp ---

settingsRoutes.get("/settings/otp", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const config = getOtpConfig();
  return c.json({
    enabled: config.enabled,
    host: config.evolution?.host ?? "",
    "api-key": config.evolution?.["api-key"] ? "***" : "",
    instance: config.evolution?.instance ?? "",
    hasApiKey: !!config.evolution?.["api-key"],
  });
});

// --- PUT /settings/otp ---

settingsRoutes.put("/settings/otp", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const body = await c.req.json<{
    enabled?: boolean;
    host?: string;
    "api-key"?: string;
    instance?: string;
  }>();

  const settings = existsSync(settingsPath())
    ? (readYaml(settingsPath()) as Record<string, unknown>)
    : {};

  const currentOtp = (settings["otp"] as Record<string, unknown> | undefined) ?? {};
  const currentEvolution = (currentOtp["evolution"] as Record<string, unknown> | undefined) ?? {};

  const updatedEvolution: Record<string, unknown> = { ...currentEvolution };
  if (body.host !== undefined) updatedEvolution["host"] = body.host;
  if (body["api-key"] !== undefined && body["api-key"] !== "***") updatedEvolution["api-key"] = body["api-key"];
  if (body.instance !== undefined) updatedEvolution["instance"] = body.instance;

  const updatedOtp: Record<string, unknown> = { ...currentOtp };
  if (body.enabled !== undefined) updatedOtp["enabled"] = body.enabled;
  updatedOtp["evolution"] = updatedEvolution;

  settings["otp"] = updatedOtp;
  writeYaml(settingsPath(), settings);

  return c.json({ ok: true });
});
