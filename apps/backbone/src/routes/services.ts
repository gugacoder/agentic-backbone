import { Hono } from "hono";
import {
  createService,
  updateService,
  deleteService,
  assignServiceToAgent,
  listAllServicesGlobally,
} from "../services/manager.js";
import { loadAgentServices } from "../services/loader.js";

export const serviceRoutes = new Hono();

// --- List Services ---

serviceRoutes.get("/services", (c) => {
  const agentId = c.req.query("agentId");
  if (agentId) {
    return c.json(loadAgentServices(agentId));
  }
  return c.json(listAllServicesGlobally());
});

// --- Create Service ---

serviceRoutes.post("/services", async (c) => {
  const body = await c.req.json();
  try {
    const service = createService(body);
    return c.json(service, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// --- Update Service ---

serviceRoutes.patch("/services/:scope/:slug", async (c) => {
  const scope = c.req.param("scope");
  const slug = c.req.param("slug");
  const body = await c.req.json();
  try {
    const service = updateService(scope, slug, body);
    return c.json(service);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 404);
  }
});

// --- Delete Service ---

serviceRoutes.delete("/services/:scope/:slug", (c) => {
  const scope = c.req.param("scope");
  const slug = c.req.param("slug");
  const deleted = deleteService(scope, slug);
  if (!deleted) return c.json({ error: "not found" }, 404);
  return c.json({ status: "deleted" });
});

// --- Assign Service to Agent ---

serviceRoutes.post("/services/assign", async (c) => {
  const { sourceScope, slug, agentId } = await c.req.json<{
    sourceScope: string;
    slug: string;
    agentId: string;
  }>();
  try {
    const resource = assignServiceToAgent(sourceScope, slug, agentId);
    return c.json(resource, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});
