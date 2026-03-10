import { Hono } from "hono";
import {
  submitJob,
  getJob,
  listJobs,
  killJob,
  clearJob,
} from "../jobs/engine.js";

export const jobRoutes = new Hono();

// POST /jobs — submit a new job
jobRoutes.post("/jobs", async (c) => {
  const body = await c.req.json<{
    agentId?: string;
    command?: string;
    cwd?: string;
    timeout?: number;
  }>();

  if (!body.agentId || !body.command) {
    return c.json({ error: "agentId and command are required" }, 400);
  }

  try {
    const summary = submitJob({
      agentId: body.agentId,
      command: body.command,
      cwd: body.cwd,
      timeout: body.timeout,
    });
    return c.json(summary, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 500);
  }
});

// GET /jobs — list jobs (optional ?agentId filter)
jobRoutes.get("/jobs", (c) => {
  const agentId = c.req.query("agentId") ?? undefined;
  return c.json(listJobs(agentId));
});

// GET /jobs/:id — get a specific job
jobRoutes.get("/jobs/:id", (c) => {
  const { id } = c.req.param();
  const job = getJob(id);
  if (!job) return c.json({ error: "not found" }, 404);
  return c.json(job);
});

// POST /jobs/:id/kill — kill a running job
jobRoutes.post("/jobs/:id/kill", (c) => {
  const { id } = c.req.param();
  const killed = killJob(id);
  if (!killed) return c.json({ error: "not found or already finished" }, 404);
  return c.json({ status: "killed" });
});

// DELETE /jobs/:id — clear a finished job from memory
jobRoutes.delete("/jobs/:id", (c) => {
  const { id } = c.req.param();
  const cleared = clearJob(id);
  if (!cleared) return c.json({ error: "not found or still running" }, 404);
  return c.json({ status: "cleared" });
});
