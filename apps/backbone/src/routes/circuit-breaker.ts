import { Hono } from "hono";
import { circuitBreaker } from "../circuit-breaker/index.js";
import { CircuitBreakerConfigUpdateSchema } from "../circuit-breaker/schemas.js";
import { getAuthUser, assertOwnership } from "./auth-helpers.js";
import { getAgent } from "../agents/registry.js";
import { formatError } from "../utils/errors.js";

export const circuitBreakerRoutes = new Hono();

// --- Resolve agent and assert ownership ---

function assertAgentOwnership(
  c: Parameters<typeof getAuthUser>[0],
  agentId: string
): Response | null {
  const agent = getAgent(agentId);
  if (!agent) return c.json({ error: "not found" }, 404);
  return assertOwnership(c, agent.owner);
}

// --- GET /agents/:id/circuit-breaker ---

circuitBreakerRoutes.get("/agents/:id/circuit-breaker", (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;

  const state = circuitBreaker.getState(agentId);
  const config = circuitBreaker.getConfig(agentId);

  return c.json({ ...state, config });
});

// --- PUT /agents/:id/circuit-breaker/config ---

circuitBreakerRoutes.put("/agents/:id/circuit-breaker/config", async (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }

  const parsed = CircuitBreakerConfigUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation error", issues: parsed.error.issues }, 422);
  }

  try {
    circuitBreaker.saveConfig(agentId, parsed.data);
    const config = circuitBreaker.getConfig(agentId);
    return c.json(config);
  } catch (err) {
    return c.json({ error: formatError(err) }, 500);
  }
});

// --- POST /agents/:id/circuit-breaker/kill ---

circuitBreakerRoutes.post("/agents/:id/circuit-breaker/kill", (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;

  const auth = getAuthUser(c);
  circuitBreaker.activateKillSwitch(agentId, auth.user);

  const state = circuitBreaker.getState(agentId);
  return c.json(state);
});

// --- POST /agents/:id/circuit-breaker/resume ---

circuitBreakerRoutes.post("/agents/:id/circuit-breaker/resume", (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;

  const auth = getAuthUser(c);

  // Deactivate kill-switch if active
  circuitBreaker.deactivateKillSwitch(agentId, auth.user);
  // Also clear any tripped state
  circuitBreaker.resume(agentId, auth.user);

  const state = circuitBreaker.getState(agentId);
  return c.json(state);
});

// --- GET /agents/:id/circuit-breaker/events ---

circuitBreakerRoutes.get("/agents/:id/circuit-breaker/events", (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;

  const limitStr = c.req.query("limit");
  const pageStr = c.req.query("page");

  const limit = limitStr ? Math.max(1, Math.min(200, parseInt(limitStr, 10))) : 50;
  const page = pageStr ? Math.max(1, parseInt(pageStr, 10)) : 1;
  const offset = (page - 1) * limit;

  const events = circuitBreaker.getEvents(agentId, limit + offset);
  const paginated = events.slice(offset, offset + limit);

  return c.json({
    events: paginated,
    page,
    limit,
    total: events.length,
  });
});

// --- GET /system/circuit-breaker ---

circuitBreakerRoutes.get("/system/circuit-breaker", (c) => {
  const auth = getAuthUser(c);

  const states = circuitBreaker.getAllStates();

  // Non-sysuser: filter to own agents only
  if (auth.role !== "sysuser") {
    const ownedAgents = new Set(
      // getAgent returns null for unknown; we check ownership
      states
        .filter((s) => {
          const agent = getAgent(s.agentId);
          return agent && agent.owner === auth.user;
        })
        .map((s) => s.agentId)
    );
    const filtered = states.filter((s) => ownedAgents.has(s.agentId));
    return c.json(filtered);
  }

  return c.json(states);
});
