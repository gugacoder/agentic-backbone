import { Hono } from "hono";
import { requireSysuser } from "./auth-helpers.js";
import {
  getCronStatus,
  listCronJobs,
  getCronJob,
  addCronJob,
  updateCronJob,
  removeCronJob,
  runCronJob,
  getCronRunHistory,
} from "../cron/index.js";
import type { CronJobDef } from "../cron/types.js";

export const cronRoutes = new Hono();

// GET /cron/status
cronRoutes.get("/cron/status", (c) => {
  return c.json(getCronStatus());
});

// GET /cron/jobs
cronRoutes.get("/cron/jobs", (c) => {
  const agentId = c.req.query("agentId") ?? undefined;
  const includeDisabled = c.req.query("includeDisabled") === "true";
  const jobs = listCronJobs({ agentId, includeDisabled });

  return c.json(
    jobs.map((j) => ({
      slug: j.slug,
      agentId: j.agentId,
      def: j.def,
      state: j.state,
    }))
  );
});

// POST /cron/jobs
cronRoutes.post("/cron/jobs", async (c) => {
  const forbidden = requireSysuser(c);
  if (forbidden) return forbidden;

  const body = await c.req.json<{
    agentId: string;
    slug: string;
    def: any;
  }>();

  if (!body.agentId || !body.slug || !body.def) {
    return c.json({ error: "agentId, slug, and def are required" }, 400);
  }

  try {
    const job = await addCronJob({
      slug: body.slug,
      agentId: body.agentId,
      def: body.def,
    });
    return c.json(
      { slug: job.slug, agentId: job.agentId, def: job.def, state: job.state },
      201
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 500);
  }
});

// GET /cron/jobs/:agentId/:slug
cronRoutes.get("/cron/jobs/:agentId/:slug", (c) => {
  const { agentId, slug } = c.req.param();
  const job = getCronJob(agentId, slug);
  if (!job) return c.json({ error: "not found" }, 404);

  return c.json({
    slug: job.slug,
    agentId: job.agentId,
    def: job.def,
    state: job.state,
  });
});

// PATCH /cron/jobs/:agentId/:slug
cronRoutes.patch("/cron/jobs/:agentId/:slug", async (c) => {
  const forbidden = requireSysuser(c);
  if (forbidden) return forbidden;

  const { agentId, slug } = c.req.param();
  const patch = await c.req.json();

  try {
    const job = await updateCronJob(agentId, slug, patch);
    return c.json({
      slug: job.slug,
      agentId: job.agentId,
      def: job.def,
      state: job.state,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return c.json({ error: msg }, 404);
    return c.json({ error: msg }, 500);
  }
});

// DELETE /cron/jobs/:agentId/:slug
cronRoutes.delete("/cron/jobs/:agentId/:slug", async (c) => {
  const forbidden = requireSysuser(c);
  if (forbidden) return forbidden;

  const { agentId, slug } = c.req.param();
  const removed = await removeCronJob(agentId, slug);
  if (!removed) return c.json({ error: "not found" }, 404);

  return c.json({ ok: true });
});

// POST /cron/jobs/:agentId/:slug/run
cronRoutes.post("/cron/jobs/:agentId/:slug/run", async (c) => {
  const forbidden = requireSysuser(c);
  if (forbidden) return forbidden;

  const { agentId, slug } = c.req.param();
  const mode = (c.req.query("mode") as "due" | "force") ?? "due";

  const result = await runCronJob(agentId, slug, mode);
  return c.json(result);
});

// GET /cron/jobs/:agentId/:slug/runs
cronRoutes.get("/cron/jobs/:agentId/:slug/runs", (c) => {
  const { slug } = c.req.param();
  const limit = Number(c.req.query("limit")) || 50;
  const offset = Number(c.req.query("offset")) || 0;

  return c.json(getCronRunHistory(slug, { limit, offset }));
});

// --- New service/request cron routes ---

// POST /cron/services — schedule a stateless service
cronRoutes.post("/cron/services", async (c) => {
  const forbidden = requireSysuser(c);
  if (forbidden) return forbidden;

  const body = await c.req.json<{
    slug: string;
    service: string;
    schedule: CronJobDef["schedule"];
    input?: Record<string, unknown>;
    description?: string;
    deleteAfterRun?: boolean;
  }>();

  if (!body.slug || !body.service || !body.schedule) {
    return c.json({ error: "slug, service, and schedule are required" }, 400);
  }

  try {
    const def: CronJobDef = {
      name: `service:${body.service}`,
      enabled: true,
      schedule: body.schedule,
      payload: {
        kind: "service",
        service: body.service,
        ...(body.input ? { input: body.input } : {}),
      },
      ...(body.deleteAfterRun != null ? { deleteAfterRun: body.deleteAfterRun } : {}),
      ...(body.description ? { description: body.description } : {}),
    };

    // Stateless service jobs go under system.main
    const job = await addCronJob({ slug: body.slug, agentId: "system.main", def });
    return c.json({ slug: job.slug, agentId: job.agentId, def: job.def, state: job.state }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 500);
  }
});

// POST /cron/agents/:id — schedule a request for an agent
cronRoutes.post("/cron/agents/:id", async (c) => {
  const forbidden = requireSysuser(c);
  if (forbidden) return forbidden;

  const agentId = c.req.param("id");
  const body = await c.req.json<{
    slug: string;
    schedule: CronJobDef["schedule"];
    service?: string;
    input?: Record<string, unknown>;
    description?: string;
    deleteAfterRun?: boolean;
  }>();

  if (!body.slug || !body.schedule) {
    return c.json({ error: "slug and schedule are required" }, 400);
  }

  try {
    const def: CronJobDef = {
      name: `request:${body.service ?? "generic"}`,
      enabled: true,
      schedule: body.schedule,
      payload: {
        kind: "request",
        ...(body.service ? { service: body.service } : {}),
        ...(body.input ? { input: body.input } : {}),
      },
      ...(body.deleteAfterRun != null ? { deleteAfterRun: body.deleteAfterRun } : {}),
      ...(body.description ? { description: body.description } : {}),
    };

    const job = await addCronJob({ slug: body.slug, agentId, def });
    return c.json({ slug: job.slug, agentId: job.agentId, def: job.def, state: job.state }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 500);
  }
});
