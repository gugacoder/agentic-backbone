import { Hono } from "hono";
import { getTrace, type TraceType } from "../traces/index.js";

export const traceRoutes = new Hono();

const VALID_TYPES = new Set<TraceType>(["heartbeat", "conversation", "cron"]);

// ── GET /traces/:type/:id ─────────────────────────────────

traceRoutes.get("/traces/:type/:id", (c) => {
  const type = c.req.param("type") as string;
  const id = c.req.param("id") as string;

  if (!VALID_TYPES.has(type as TraceType)) {
    return c.json({ error: "type must be heartbeat, conversation, or cron" }, 400);
  }

  const trace = getTrace(type as TraceType, id);
  if (!trace) {
    return c.json({ error: "trace not found" }, 404);
  }

  return c.json(trace);
});
