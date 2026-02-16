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
