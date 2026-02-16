import { Hono } from "hono";
import { requireSysuser } from "./auth-helpers.js";
import { loadLlmConfig, saveLlmConfig } from "../settings/llm.js";
import type { LlmProvider } from "../settings/llm.js";

export const settingsRoutes = new Hono();

// --- GET /settings/llm ---

settingsRoutes.get("/settings/llm", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const config = loadLlmConfig();
  return c.json(config);
});

// --- PATCH /settings/llm ---

settingsRoutes.patch("/settings/llm", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const body = await c.req.json<{ active?: string; provider?: LlmProvider }>();

  const config = loadLlmConfig();

  // Update provider if provided
  if (body.provider) {
    if (!config.plans[body.provider]) {
      return c.json({ error: `provider "${body.provider}" not found` }, 404);
    }
    config.provider = body.provider;

    // Validate that the current active plan exists in the new provider
    if (!config.plans[config.provider][config.active]) {
      // Fall back to first available plan in the new provider
      const firstPlan = Object.keys(config.plans[config.provider])[0];
      if (firstPlan) {
        config.active = firstPlan;
      }
    }
  }

  // Update active plan if provided
  if (body.active) {
    const providerPlans = config.plans[config.provider];
    if (!providerPlans[body.active]) {
      return c.json({ error: `plan "${body.active}" not found for provider "${config.provider}"` }, 404);
    }
    config.active = body.active;
  }

  if (!body.active && !body.provider) {
    return c.json({ error: "at least one of 'active' or 'provider' is required" }, 400);
  }

  saveLlmConfig(config);
  return c.json(config);
});
