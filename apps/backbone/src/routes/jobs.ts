import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  submitJob,
  getJob,
  getJobSession,
  listJobs,
  killJob,
  clearJob,
} from "../jobs/engine.js";
import { eventBus, type JobStatusEvent } from "../events/index.js";

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

// GET /jobs/:id/stream — SSE stream of stdout/stderr for a job
jobRoutes.get("/jobs/:id/stream", (c) => {
  const { id } = c.req.param();
  const session = getJobSession(id);
  if (!session) return c.json({ error: "not found" }, 404);

  return streamSSE(c, async (stream) => {
    // For finished jobs: emit accumulated output + status, then close
    if (session.status !== "running") {
      if (session.stdout) {
        await stream.writeSSE({
          event: "stdout",
          data: JSON.stringify({ line: session.stdout, ts: new Date(session.startedAt).toISOString() }),
        });
      }
      if (session.stderr) {
        await stream.writeSSE({
          event: "stderr",
          data: JSON.stringify({ line: session.stderr, ts: new Date(session.startedAt).toISOString() }),
        });
      }
      await stream.writeSSE({
        event: "status",
        data: JSON.stringify({
          status: session.status,
          exitCode: session.exitCode ?? null,
          finishedAt: session.endedAt ? new Date(session.endedAt).toISOString() : null,
        }),
      });
      return;
    }

    // For running jobs: send accumulated output first, then stream new data
    if (session.stdout) {
      await stream.writeSSE({
        event: "stdout",
        data: JSON.stringify({ line: session.stdout, ts: new Date(session.startedAt).toISOString() }),
      });
    }
    if (session.stderr) {
      await stream.writeSSE({
        event: "stderr",
        data: JSON.stringify({ line: session.stderr, ts: new Date(session.startedAt).toISOString() }),
      });
    }

    // Attach listeners to child process streams
    const child = session._child;
    let closed = false;

    const cleanup = () => {
      closed = true;
      eventBus.off("job:status", onJobStatus);
      if (child?.stdout) child.stdout.off("data", onStdout);
      if (child?.stderr) child.stderr.off("data", onStderr);
    };

    const onStdout = (chunk: Buffer) => {
      if (closed) return;
      stream.writeSSE({
        event: "stdout",
        data: JSON.stringify({ line: chunk.toString(), ts: new Date().toISOString() }),
      }).catch(() => cleanup());
    };

    const onStderr = (chunk: Buffer) => {
      if (closed) return;
      stream.writeSSE({
        event: "stderr",
        data: JSON.stringify({ line: chunk.toString(), ts: new Date().toISOString() }),
      }).catch(() => cleanup());
    };

    const onJobStatus = (event: JobStatusEvent) => {
      if (event.jobId !== id || closed) return;
      stream.writeSSE({
        event: "status",
        data: JSON.stringify({
          status: event.status,
          exitCode: event.exitCode ?? null,
          finishedAt: new Date().toISOString(),
        }),
      }).then(() => cleanup()).catch(() => cleanup());
    };

    if (child?.stdout) child.stdout.on("data", onStdout);
    if (child?.stderr) child.stderr.on("data", onStderr);
    eventBus.on("job:status", onJobStatus);

    // Keep connection alive until job finishes or client disconnects
    stream.onAbort(() => cleanup());

    // Wait until closed
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (closed || session.status !== "running") {
          clearInterval(check);
          resolve();
        }
      }, 500);
    });
  });
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
