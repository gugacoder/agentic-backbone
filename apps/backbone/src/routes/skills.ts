import { Hono } from "hono";
import {
  createSkill,
  updateSkill,
  deleteSkill,
  assignSkillToAgent,
  listAllSkillsGlobally,
} from "../skills/manager.js";
import { loadAllSkills } from "../skills/loader.js";

export const skillRoutes = new Hono();

// --- List All Skills (global) ---

skillRoutes.get("/skills", (c) => {
  const agentId = c.req.query("agentId");
  if (agentId) {
    return c.json(loadAllSkills(agentId));
  }
  return c.json(listAllSkillsGlobally());
});

// --- Create Skill ---

skillRoutes.post("/skills", async (c) => {
  const body = await c.req.json();
  try {
    const skill = createSkill(body);
    return c.json(skill, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// --- Update Skill ---

skillRoutes.patch("/skills/:scope/:slug", async (c) => {
  const scope = c.req.param("scope");
  const slug = c.req.param("slug");
  const body = await c.req.json();
  try {
    const skill = updateSkill(scope, slug, body);
    return c.json(skill);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 404);
  }
});

// --- Delete Skill ---

skillRoutes.delete("/skills/:scope/:slug", (c) => {
  const scope = c.req.param("scope");
  const slug = c.req.param("slug");
  const deleted = deleteSkill(scope, slug);
  if (!deleted) return c.json({ error: "not found" }, 404);
  return c.json({ status: "deleted" });
});

// --- Assign Skill to Agent ---

skillRoutes.post("/skills/assign", async (c) => {
  const { sourceScope, slug, agentId } = await c.req.json<{
    sourceScope: string;
    slug: string;
    agentId: string;
  }>();
  try {
    const resource = assignSkillToAgent(sourceScope, slug, agentId);
    return c.json(resource, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});
