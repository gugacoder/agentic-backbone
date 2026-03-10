import { Hono } from "hono";
import {
  createTool,
  updateTool,
  deleteTool,
  assignToolToAgent,
  listAllToolsGlobally,
} from "../tools/manager.js";
import { loadAgentTools } from "../tools/loader.js";

export const toolRoutes = new Hono();

// --- List All Tools (global) ---

toolRoutes.get("/tools", (c) => {
  const agentId = c.req.query("agentId");
  if (agentId) {
    return c.json(loadAgentTools(agentId));
  }
  return c.json(listAllToolsGlobally());
});

// --- Create Tool ---

toolRoutes.post("/tools", async (c) => {
  const body = await c.req.json();
  try {
    const tool = createTool(body);
    return c.json(tool, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// --- Update Tool ---

toolRoutes.patch("/tools/:scope/:slug", async (c) => {
  const scope = c.req.param("scope");
  const slug = c.req.param("slug");
  const body = await c.req.json();
  try {
    const tool = updateTool(scope, slug, body);
    return c.json(tool);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 404);
  }
});

// --- Delete Tool ---

toolRoutes.delete("/tools/:scope/:slug", (c) => {
  const scope = c.req.param("scope");
  const slug = c.req.param("slug");
  const deleted = deleteTool(scope, slug);
  if (!deleted) return c.json({ error: "not found" }, 404);
  return c.json({ status: "deleted" });
});

// --- Assign Tool to Agent ---

toolRoutes.post("/tools/assign", async (c) => {
  const { sourceScope, slug, agentId } = await c.req.json<{
    sourceScope: string;
    slug: string;
    agentId: string;
  }>();
  try {
    const resource = assignToolToAgent(sourceScope, slug, agentId);
    return c.json(resource, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});
