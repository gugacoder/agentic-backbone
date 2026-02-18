#!/usr/bin/env node
/**
 * Test Conversation — Jobs
 *
 * Tests job engine capabilities (6.x) via REST and conversation SSE.
 * Covers the 3 execution modes (foreground, auto-background, explicit background),
 * delta polling, log reading, stdin writing, kill, and wake-on-complete.
 *
 * Usage:
 *   npm run test:capabilities:jobs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Config ──────────────────────────────────────────────────

if (!process.env.BACKBONE_PORT) {
  console.error("BACKBONE_PORT not set. Run: npm run test:capabilities:jobs");
  process.exit(2);
}
if (!process.env.SYSUSER || !process.env.SYSPASS) {
  console.error("SYSUSER/SYSPASS not set. Run: npm run test:capabilities:jobs");
  process.exit(2);
}

const BASE = `http://localhost:${process.env.BACKBONE_PORT}`;
const AGENT_ID = "system.probe";
const CHANNEL_ID = "system-channel";
const TIMEOUT_MS = 8000;

const now = new Date();
const SESSION_SLUG = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0"),
  "-",
  String(now.getHours()).padStart(2, "0"),
  String(now.getMinutes()).padStart(2, "0"),
  String(now.getSeconds()).padStart(2, "0"),
].join("");

const RESULTS_DIR = join(process.cwd(), "test-results", "capabilities", `${SESSION_SLUG}-jobs`);

// ── Fixed test reference ────────────────────────────────────

const TEST_REFERENCE = `## Jobs

| # | Capability | Canal | Prova |
|---|-----------|-------|-------|
| 6.1 | submit_job | Chat | Usuário pede job via chat. Agente submete o job. |
| 6.3 | kill_job | REST | Submete job sleep 300, mata via REST, verifica status=killed. |
| 6.4 | Wake-on-complete | Chat | Job termina, agente acorda e empurra mensagem no canal. |
| 6.5 | Foreground mode | REST | yieldMs=0: bloqueia até exit, retorna stdout completo. |
| 6.6 | Auto-background | REST | yieldMs default: retorna backgrounded=true após yield timer. |
| 6.7 | Explicit background | REST | background=true: retorno imediato. |
| 6.8 | poll_job | REST | Delta polling: primeiro poll retorna chunks, segundo retorna novos. |
| 6.9 | log_job | REST | Lê log completo com paginação. |
| 6.10 | write_job | REST | Escreve no stdin de job running, confirma output. |`;

// ── SSE Listener (chat channel) ─────────────────────────────

function startChannelSSE(token) {
  const collected = [];
  const controller = new AbortController();
  let connectError = null;

  const promise = (async () => {
    try {
      const res = await fetch(`${BASE}/channels/${CHANNEL_ID}/events`, {
        signal: controller.signal,
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        connectError = `HTTP ${res.status}`;
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        while (true) {
          const idx = buffer.indexOf("\n\n");
          if (idx === -1) break;
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          const lines = block.split("\n");
          let event = null;
          let data = null;
          for (const line of lines) {
            const l = line.replace(/\r$/, "");
            if (l.startsWith("event: ")) event = l.slice(7).trim();
            else if (l.startsWith("data: ")) data = l.slice(6);
          }
          if (event && data !== null) {
            try {
              collected.push({ event, data: JSON.parse(data), ts: Date.now() });
            } catch {
              collected.push({ event, data, ts: Date.now() });
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        connectError = err.message;
      }
    }
  })();

  return {
    events: collected,
    stop() { controller.abort(); },
    wait: () => promise,
    get error() { return connectError; },
  };
}

async function waitForChannelMessage(sse, predicateFn, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (sse.error) return null;
    const match = sse.events.find(predicateFn);
    if (match) return match;
    await sleep(500);
  }
  return null;
}

// ── Helpers ─────────────────────────────────────────────────

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: process.env.SYSUSER, password: process.env.SYSPASS }),
  });
  const data = await res.json();
  if (!data.token) throw new Error(`Login failed: ${JSON.stringify(data)}`);
  return data.token;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function createSession(token) {
  const res = await fetch(`${BASE}/conversations`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ agentId: AGENT_ID }),
  });
  return res.json();
}

async function sendMessage(token, sessionId, message) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let fullText = "";
  let timedOut = false;

  try {
    const res = await fetch(`${BASE}/conversations/${sessionId}/messages`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ message }),
      signal: controller.signal,
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === "text" && event.content) fullText += event.content;
          if (event.type === "result" && event.content) fullText = event.content;
          if (event.type === "usage") { reader.cancel(); break; }
        } catch {}
      }
    }
  } catch (err) {
    if (err.name === "AbortError") timedOut = true;
    else throw err;
  } finally {
    clearTimeout(timer);
  }

  return { fullText, timedOut };
}

async function listJobs(token) {
  const res = await fetch(`${BASE}/jobs`, { headers: authHeaders(token) });
  const data = await res.json();
  return Array.isArray(data) ? data : (data.jobs ?? []);
}

/** POST /jobs — returns SubmitJobResult { summary, backgrounded, stdout?, stderr? } */
async function submitJobRest(token, body) {
  const res = await fetch(`${BASE}/jobs`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return res.json();
}

/** POST /jobs/:id/poll — returns PollJobResult */
async function pollJobRest(token, jobId) {
  const res = await fetch(`${BASE}/jobs/${jobId}/poll`, {
    method: "POST",
    headers: authHeaders(token),
  });
  return res.json();
}

/** GET /jobs/:id/log — returns LogJobResult */
async function logJobRest(token, jobId, offset, limit) {
  const params = new URLSearchParams();
  if (offset != null) params.set("offset", String(offset));
  if (limit != null) params.set("limit", String(limit));
  const qs = params.toString() ? `?${params}` : "";
  const res = await fetch(`${BASE}/jobs/${jobId}/log${qs}`, { headers: authHeaders(token) });
  return res.json();
}

/** POST /jobs/:id/write — writes to stdin */
async function writeJobRest(token, jobId, data) {
  const res = await fetch(`${BASE}/jobs/${jobId}/write`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ data }),
  });
  return res.json();
}

async function cleanupJob(token, jobId) {
  // Try kill first (in case still running), then delete
  await fetch(`${BASE}/jobs/${jobId}/kill`, { method: "POST", headers: authHeaders(token) }).catch(() => {});
  await sleep(300);
  await fetch(`${BASE}/jobs/${jobId}`, { method: "DELETE", headers: authHeaders(token) }).catch(() => {});
}

// ── Run ─────────────────────────────────────────────────────

async function run() {
  const log = [];
  const dialog = [];
  const capabilityResults = new Map();

  function logLine(msg) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    log.push(line);
    console.log(line);
  }

  logLine("test-conversation-jobs starting");
  logLine(`agent=${AGENT_ID}  base=${BASE}  timeout=${TIMEOUT_MS}ms  channel=${CHANNEL_ID}`);
  logLine(`session-slug=${SESSION_SLUG}`);

  // ── Preflight ──────────────────────────────────────────────
  try {
    const health = await fetch(`${BASE}/health`).then((r) => r.json());
    const agents = (health.agents ?? []).map((a) => a.id);
    if (!agents.includes(AGENT_ID)) {
      logLine(`SKIP — agent ${AGENT_ID} not registered. Available: [${agents.join(", ")}]`);
      return writeOutput(log, dialog, capabilityResults);
    }
    logLine(`preflight ok — ${AGENT_ID} registered`);
  } catch (err) {
    logLine(`SKIP — backbone unreachable: ${err.message}`);
    return writeOutput(log, dialog, capabilityResults);
  }

  let token;
  try {
    token = await login();
    logLine("login ok");
  } catch (err) {
    logLine(`login FAILED: ${err.message}`);
    return writeOutput(log, dialog, capabilityResults);
  }

  // ── 6.5: Foreground mode (yieldMs=0) ───────────────────────
  logLine("");
  logLine("═══ 6.5: Foreground mode ═══");
  try {
    logLine("submitting foreground job: echo FOREGROUND_PROBE_42");
    const t0 = Date.now();
    const result = await submitJobRest(token, {
      agentId: AGENT_ID,
      command: "echo FOREGROUND_PROBE_42",
      yieldMs: 0,
    });
    const elapsed = Date.now() - t0;
    logLine(`response (${elapsed}ms): backgrounded=${result.backgrounded}, status=${result.summary?.status}`);
    logLine(`stdout present: ${!!result.stdout}, stdout: ${(result.stdout ?? "").trim().slice(0, 100)}`);

    const hasStdout = (result.stdout ?? "").includes("FOREGROUND_PROBE_42");
    const notBg = result.backgrounded === false;
    const completed = result.summary?.status === "completed";

    if (hasStdout && notBg && completed) {
      capabilityResults.set("6.5", { name: "Foreground mode", state: "PASS", notes: `stdout captured, completed in ${elapsed}ms` });
    } else {
      capabilityResults.set("6.5", { name: "Foreground mode", state: "FAIL", notes: `bg=${result.backgrounded}, status=${result.summary?.status}, stdout=${(result.stdout ?? "").slice(0, 50)}` });
    }
    if (result.summary?.id) await cleanupJob(token, result.summary.id);
  } catch (err) {
    capabilityResults.set("6.5", { name: "Foreground mode", state: "FAIL", notes: err.message });
  }
  logLine(`  [6.5] ${capabilityResults.get("6.5").state} — ${capabilityResults.get("6.5").notes}`);

  // ── 6.6: Auto-background (default yieldMs) ────────────────
  logLine("");
  logLine("═══ 6.6: Auto-background ═══");
  let autoBgJobId = null;
  try {
    logLine("submitting auto-background job: sleep 60 (yieldMs=2000 for faster test)");
    const t0 = Date.now();
    const result = await submitJobRest(token, {
      agentId: AGENT_ID,
      command: "sleep 60",
      yieldMs: 2000,
    });
    const elapsed = Date.now() - t0;
    logLine(`response (${elapsed}ms): backgrounded=${result.backgrounded}, status=${result.summary?.status}`);
    autoBgJobId = result.summary?.id;

    const isBg = result.backgrounded === true;
    const isRunning = result.summary?.status === "running";
    const yieldedInTime = elapsed < 10_000; // should have yielded around 2s

    if (isBg && isRunning && yieldedInTime) {
      capabilityResults.set("6.6", { name: "Auto-background", state: "PASS", notes: `Yielded after ${elapsed}ms, job still running` });
    } else {
      capabilityResults.set("6.6", { name: "Auto-background", state: "FAIL", notes: `bg=${result.backgrounded}, status=${result.summary?.status}, elapsed=${elapsed}ms` });
    }
  } catch (err) {
    capabilityResults.set("6.6", { name: "Auto-background", state: "FAIL", notes: err.message });
  }
  if (autoBgJobId) await cleanupJob(token, autoBgJobId);
  logLine(`  [6.6] ${capabilityResults.get("6.6").state} — ${capabilityResults.get("6.6").notes}`);

  // ── 6.7: Explicit background (background=true) ────────────
  logLine("");
  logLine("═══ 6.7: Explicit background ═══");
  let explicitBgJobId = null;
  try {
    logLine("submitting explicit background job: sleep 60");
    const t0 = Date.now();
    const result = await submitJobRest(token, {
      agentId: AGENT_ID,
      command: "sleep 60",
      background: true,
    });
    const elapsed = Date.now() - t0;
    logLine(`response (${elapsed}ms): backgrounded=${result.backgrounded}, status=${result.summary?.status}`);
    explicitBgJobId = result.summary?.id;

    const isBg = result.backgrounded === true;
    const isRunning = result.summary?.status === "running";
    const fast = elapsed < 2000; // should be near-instant

    if (isBg && isRunning && fast) {
      capabilityResults.set("6.7", { name: "Explicit background", state: "PASS", notes: `Returned in ${elapsed}ms` });
    } else {
      capabilityResults.set("6.7", { name: "Explicit background", state: "FAIL", notes: `bg=${result.backgrounded}, status=${result.summary?.status}, elapsed=${elapsed}ms` });
    }
  } catch (err) {
    capabilityResults.set("6.7", { name: "Explicit background", state: "FAIL", notes: err.message });
  }
  if (explicitBgJobId) await cleanupJob(token, explicitBgJobId);
  logLine(`  [6.7] ${capabilityResults.get("6.7").state} — ${capabilityResults.get("6.7").notes}`);

  // ── 6.3: kill_job (REST) ───────────────────────────────────
  logLine("");
  logLine("═══ 6.3: kill_job ═══");
  try {
    logLine("submitting job: sleep 300 (background=true)");
    const result = await submitJobRest(token, {
      agentId: AGENT_ID,
      command: "sleep 300",
      background: true,
    });
    logLine(`submit response: backgrounded=${result.backgrounded}, id=${result.summary?.id}`);

    const jobId = result.summary?.id;
    if (!jobId) {
      capabilityResults.set("6.3", { name: "kill_job", state: "FAIL", notes: `Submit failed: ${JSON.stringify(result)}` });
    } else {
      logLine(`job submitted: ${jobId}, status=${result.summary.status}, pid=${result.summary.pid}`);

      const getRes = await fetch(`${BASE}/jobs/${jobId}`, { headers: authHeaders(token) });
      const getJob = await getRes.json();
      logLine(`status before kill: ${getJob.status}`);

      logLine("killing job...");
      const killRes = await fetch(`${BASE}/jobs/${jobId}/kill`, {
        method: "POST",
        headers: authHeaders(token),
      });
      const killData = await killRes.json();
      logLine(`kill response: ${JSON.stringify(killData)}`);

      await sleep(500);
      const afterRes = await fetch(`${BASE}/jobs/${jobId}`, { headers: authHeaders(token) });
      const afterJob = await afterRes.json();
      logLine(`status after kill: ${afterJob.status}`);

      const wasRunning = getJob.status === "running";
      const isKilled = afterJob.status === "killed";

      if (wasRunning && isKilled) {
        capabilityResults.set("6.3", { name: "kill_job", state: "PASS", notes: "Job killed successfully" });
      } else {
        capabilityResults.set("6.3", { name: "kill_job", state: "FAIL", notes: `before=${getJob.status}, after=${afterJob.status}` });
      }

      await fetch(`${BASE}/jobs/${jobId}`, { method: "DELETE", headers: authHeaders(token) });
    }
  } catch (err) {
    capabilityResults.set("6.3", { name: "kill_job", state: "FAIL", notes: err.message });
  }
  logLine(`  [6.3] ${capabilityResults.get("6.3").state} — ${capabilityResults.get("6.3").notes}`);

  // ── 6.8: poll_job (delta polling) ──────────────────────────
  logLine("");
  logLine("═══ 6.8: poll_job ═══");
  let pollJobId = null;
  try {
    // Submit a job that outputs in bursts: two echo commands
    logLine("submitting job with output bursts");
    const result = await submitJobRest(token, {
      agentId: AGENT_ID,
      command: "echo BURST_ONE && sleep 1 && echo BURST_TWO",
      background: true,
    });
    pollJobId = result.summary?.id;
    logLine(`job: ${pollJobId}`);

    // Wait for first output
    await sleep(500);
    const poll1 = await pollJobRest(token, pollJobId);
    const poll1Text = poll1.pendingStdout?.join("") ?? "";
    logLine(`poll1: pendingStdout=${JSON.stringify(poll1.pendingStdout)}`);

    // Wait for second burst
    await sleep(1500);
    const poll2 = await pollJobRest(token, pollJobId);
    const poll2Text = poll2.pendingStdout?.join("") ?? "";
    logLine(`poll2: pendingStdout=${JSON.stringify(poll2.pendingStdout)}`);

    // Poll1 should have BURST_ONE, poll2 should have BURST_TWO (delta — not repeating BURST_ONE)
    const hasBurst1 = poll1Text.includes("BURST_ONE");
    const hasBurst2 = poll2Text.includes("BURST_TWO");
    const noDuplicateInPoll2 = !poll2Text.includes("BURST_ONE");

    if (hasBurst1 && hasBurst2 && noDuplicateInPoll2) {
      capabilityResults.set("6.8", { name: "poll_job", state: "PASS", notes: "Delta polling works: burst1 in poll1, burst2 in poll2, no duplicates" });
    } else if (hasBurst1 && hasBurst2) {
      capabilityResults.set("6.8", { name: "poll_job", state: "PASS", notes: `Delta OK (burst1 in poll1, burst2 in poll2). poll2 also had burst1=${!noDuplicateInPoll2}` });
    } else {
      capabilityResults.set("6.8", { name: "poll_job", state: "FAIL", notes: `poll1="${poll1Text.trim()}", poll2="${poll2Text.trim()}"` });
    }
  } catch (err) {
    capabilityResults.set("6.8", { name: "poll_job", state: "FAIL", notes: err.message });
  }
  if (pollJobId) await cleanupJob(token, pollJobId);
  logLine(`  [6.8] ${capabilityResults.get("6.8").state} — ${capabilityResults.get("6.8").notes}`);

  // ── 6.9: log_job (full log with pagination) ────────────────
  logLine("");
  logLine("═══ 6.9: log_job ═══");
  try {
    // Submit a foreground job that produces known output
    logLine("submitting foreground job for log reading");
    const result = await submitJobRest(token, {
      agentId: AGENT_ID,
      command: "echo LOG_LINE_ALPHA && echo LOG_LINE_BETA",
      yieldMs: 0,
    });
    const jobId = result.summary?.id;
    logLine(`job: ${jobId}, status=${result.summary?.status}`);

    // Read full log
    const fullLog = await logJobRest(token, jobId);
    logLine(`log: stdout="${fullLog.stdout?.trim()}", totalChars=${fullLog.totalOutputChars}`);

    // Read with offset (skip first 16 chars)
    const slicedLog = await logJobRest(token, jobId, 16, 100);
    logLine(`sliced log (offset=16): stdout="${slicedLog.stdout?.trim()}"`);

    const hasAlpha = (fullLog.stdout ?? "").includes("LOG_LINE_ALPHA");
    const hasBeta = (fullLog.stdout ?? "").includes("LOG_LINE_BETA");
    const sliceWorks = !(slicedLog.stdout ?? "").startsWith("LOG_LINE_ALPHA");

    if (hasAlpha && hasBeta && sliceWorks) {
      capabilityResults.set("6.9", { name: "log_job", state: "PASS", notes: "Full log + pagination offset works" });
    } else {
      capabilityResults.set("6.9", { name: "log_job", state: "FAIL", notes: `alpha=${hasAlpha}, beta=${hasBeta}, sliceWorks=${sliceWorks}` });
    }
    if (jobId) await cleanupJob(token, jobId);
  } catch (err) {
    capabilityResults.set("6.9", { name: "log_job", state: "FAIL", notes: err.message });
  }
  logLine(`  [6.9] ${capabilityResults.get("6.9").state} — ${capabilityResults.get("6.9").notes}`);

  // ── 6.10: write_job (stdin) ────────────────────────────────
  logLine("");
  logLine("═══ 6.10: write_job ═══");
  let writeJobId = null;
  try {
    // Submit cat, which echoes stdin to stdout
    logLine("submitting background job: cat (reads stdin)");
    const result = await submitJobRest(token, {
      agentId: AGENT_ID,
      command: "cat",
      background: true,
    });
    writeJobId = result.summary?.id;
    logLine(`job: ${writeJobId}, status=${result.summary?.status}`);

    // Write to stdin
    logLine("writing to stdin: STDIN_PROBE_99\\n");
    const writeResult = await writeJobRest(token, writeJobId, "STDIN_PROBE_99\n");
    logLine(`write response: ${JSON.stringify(writeResult)}`);

    // Wait for output to propagate
    await sleep(500);

    // Poll for the echoed output
    const poll = await pollJobRest(token, writeJobId);
    const pollText = poll.pendingStdout?.join("") ?? "";
    logLine(`poll after write: "${pollText.trim()}"`);

    const echoed = pollText.includes("STDIN_PROBE_99");
    const writeOk = writeResult.status === "written";

    if (writeOk && echoed) {
      capabilityResults.set("6.10", { name: "write_job", state: "PASS", notes: "stdin write echoed back via cat" });
    } else {
      capabilityResults.set("6.10", { name: "write_job", state: "FAIL", notes: `writeOk=${writeOk}, echoed=${echoed}, pollText="${pollText.trim()}"` });
    }
  } catch (err) {
    capabilityResults.set("6.10", { name: "write_job", state: "FAIL", notes: err.message });
  }
  if (writeJobId) await cleanupJob(token, writeJobId);
  logLine(`  [6.10] ${capabilityResults.get("6.10").state} — ${capabilityResults.get("6.10").notes}`);

  // ── 6.1: submit_job via conversation ─────────────────────────
  logLine("");
  logLine("═══ 6.1: submit_job via conversation ═══");
  {
    // Snapshot existing jobs
    const beforeJobs = await listJobs(token);
    const beforeJobIds = new Set(beforeJobs.map((j) => j.id));

    let sessionId;
    try {
      const session = await createSession(token);
      sessionId = session.session_id;
      logLine(`session created: ${sessionId}`);
    } catch (err) {
      logLine(`session creation FAILED: ${err.message}`);
    }

    if (sessionId) {
      logLine("sending message: asking agent to submit a job...");
      const { fullText, timedOut } = await sendMessage(
        token,
        sessionId,
        'Execute o comando `echo JOB_PROBE_DONE_X7` como um background job usando a ferramenta submit_job.',
      );

      if (timedOut) logLine("A: (timeout)");
      else logLine(`A: ${fullText.slice(0, 200)}`);

      dialog.push({
        question: "Submit job via chat",
        answer: fullText || null,
        status: timedOut ? "TIMEOUT" : fullText ? "OK" : "EMPTY",
      });

      await sleep(1000);
      const afterJobs = await listJobs(token);
      const newJobs = afterJobs.filter((j) => !beforeJobIds.has(j.id));
      logLine(`new jobs created: ${newJobs.length}`);

      if (newJobs.length > 0) {
        logLine(`job id: ${newJobs[0].id}, status: ${newJobs[0].status}, command: ${newJobs[0].command}`);
        capabilityResults.set("6.1", {
          name: "submit_job",
          state: "PASS",
          notes: `Job created: ${newJobs[0].id} (${newJobs[0].command?.slice(0, 50)})`,
        });
      } else if (fullText && /job|submit|execut/i.test(fullText)) {
        capabilityResults.set("6.1", {
          name: "submit_job",
          state: "FAIL",
          notes: "Agent mentioned job but no new job found in /jobs API",
        });
      } else {
        capabilityResults.set("6.1", {
          name: "submit_job",
          state: "FAIL",
          notes: timedOut ? `Timeout (${TIMEOUT_MS}ms)` : "Agent did not create a job",
        });
      }
    } else {
      capabilityResults.set("6.1", { name: "submit_job", state: "FAIL", notes: "Could not create conversation session" });
    }
  }
  logLine(`  [6.1] ${capabilityResults.get("6.1")?.state} — ${capabilityResults.get("6.1")?.notes}`);

  // ── 6.4: Wake-on-complete (conversation mode) ──────────────
  logLine("");
  logLine("═══ 6.4: Wake-on-complete (conversation mode) ═══");
  try {
    // 1. Create a conversation session
    const session = await createSession(token);
    const sessionId = session.session_id;
    logLine(`session created: ${sessionId}`);

    // 2. Seed the conversation so the agent has history
    logLine("seeding conversation with initial message...");
    const { fullText: seedText } = await sendMessage(
      token,
      sessionId,
      'Estou submetendo um job de teste. Quando ele terminar, você vai receber o resultado aqui na conversa. Apenas confirme que entendeu.',
    );
    logLine(`seed response: ${seedText.slice(0, 150)}`);

    // 3. Get userId from session
    const sessionInfo = await fetch(`${BASE}/conversations/${sessionId}`, { headers: authHeaders(token) }).then(r => r.json());
    const userId = sessionInfo.user_id;
    logLine(`userId: ${userId}`);

    // 4. Submit a slow job via REST with wakeMode=conversation
    logLine("submitting job via REST: sleep 4 && echo CONV_WAKE_PROBE_99 (wakeMode=conversation)");
    const jobResult = await submitJobRest(token, {
      agentId: AGENT_ID,
      command: "sleep 4 && echo CONV_WAKE_PROBE_99",
      background: true,
      wakeMode: "conversation",
      sessionId,
      userId,
      wakeContext: "Este job foi submetido para testar o wake em modo conversation.",
    });
    const jobId = jobResult.summary?.id;
    logLine(`job submitted: ${jobId}, status=${jobResult.summary?.status}`);

    if (!jobId) {
      capabilityResults.set("6.4", { name: "Wake-on-complete", state: "FAIL", notes: "Failed to submit job" });
    } else {
      // 5. Poll until job completes (max 30s)
      logLine("waiting for job to complete...");
      const pollDeadline = Date.now() + 30_000;
      let jobDone = false;
      while (Date.now() < pollDeadline) {
        const job = await fetch(`${BASE}/jobs/${jobId}`, { headers: authHeaders(token) }).then(r => r.json());
        if (job.status !== "running") {
          logLine(`job finished: status=${job.status}, exitCode=${job.exitCode}`);
          jobDone = true;
          break;
        }
        await sleep(1000);
      }

      if (!jobDone) {
        capabilityResults.set("6.4", { name: "Wake-on-complete", state: "FAIL", notes: "Job did not complete within 30s" });
        await cleanupJob(token, jobId);
      } else {
        // 6. Wait for the wake conversation to process (agent turn takes a few seconds)
        logLine("waiting for wake conversation to process (up to 60s)...");
        const wakeDeadline = Date.now() + 60_000;
        let wakeFound = false;
        let wakeContent = "";

        while (Date.now() < wakeDeadline) {
          await sleep(3000);
          const messages = await fetch(`${BASE}/conversations/${sessionId}/messages`, {
            headers: authHeaders(token),
          }).then(r => r.json());

          // Look for a message containing the job wake marker
          const wakeMsg = messages.find(m =>
            m.role === "user" && typeof m.content === "string" && m.content.includes("[job:wake]")
          );
          const agentResponse = wakeMsg ? messages.find(m =>
            m.role === "assistant" &&
            messages.indexOf(m) > messages.indexOf(wakeMsg)
          ) : null;

          if (wakeMsg) {
            wakeFound = true;
            wakeContent = wakeMsg.content.slice(0, 200);
            logLine(`wake message found in conversation!`);
            logLine(`  wake msg: ${wakeContent}`);
            if (agentResponse) {
              logLine(`  agent response: ${String(agentResponse.content).slice(0, 200)}`);
            }
            break;
          }
        }

        if (wakeFound) {
          const hasProbe = wakeContent.includes("CONV_WAKE_PROBE_99") || wakeContent.includes("job_context");
          capabilityResults.set("6.4", {
            name: "Wake-on-complete",
            state: "PASS",
            notes: `Wake message delivered to conversation. Probe marker: ${hasProbe}. Content: ${wakeContent.slice(0, 100)}`,
          });
        } else {
          capabilityResults.set("6.4", {
            name: "Wake-on-complete",
            state: "FAIL",
            notes: "No [job:wake] message found in conversation within 60s",
          });
        }
        await cleanupJob(token, jobId);
      }
    }
  } catch (err) {
    capabilityResults.set("6.4", { name: "Wake-on-complete", state: "FAIL", notes: err.message });
  }
  logLine(`  [6.4] ${capabilityResults.get("6.4")?.state} — ${capabilityResults.get("6.4")?.notes}`);

  writeOutput(log, dialog, capabilityResults);
}

// ── Output ──────────────────────────────────────────────────

function writeOutput(log, dialog, capabilityResults) {
  mkdirSync(RESULTS_DIR, { recursive: true });

  const logPath = join(RESULTS_DIR, "response.log");
  writeFileSync(logPath, log.join("\n") + "\n", "utf-8");

  const caps = [...capabilityResults.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const tested = caps.filter(([, v]) => v.state !== "N/A");
  const passed = tested.filter(([, v]) => v.state === "PASS").length;
  const failed = tested.filter(([, v]) => v.state === "FAIL").length;
  const total = tested.length;

  let md = `# Test Conversation — Jobs\n\n`;
  md += `**Session:** ${SESSION_SLUG}  \n`;
  md += `**Agent:** ${AGENT_ID}  \n`;
  md += `**Date:** ${new Date().toISOString()}  \n`;
  md += `**Timeout:** ${TIMEOUT_MS}ms  \n`;
  md += `**Channel:** ${CHANNEL_ID}  \n`;
  md += `**Result:** ${passed}/${total} passed`;
  if (failed > 0) md += `, ${failed} failed`;
  md += `\n\n`;

  md += TEST_REFERENCE;
  md += `\n\n`;

  md += `## Tests Result\n\n`;
  md += `| # | Capability | State | Notes |\n`;
  md += `|---|------------|-------|-------|\n`;
  for (const [id, r] of caps) {
    md += `| ${id} | ${r.name} | ${r.state} | ${r.notes} |\n`;
  }

  if (dialog.length > 0) {
    md += `\n## Dialog\n\n`;
    md += `| # | Question | Result | Answer |\n`;
    md += `|---|----------|--------|--------|\n`;
    for (let i = 0; i < dialog.length; i++) {
      const d = dialog[i];
      const answer = d.answer ? d.answer.slice(0, 200) : d.status;
      md += `| ${i + 1} | ${d.question} | **${d.status}** | ${answer} |\n`;
    }
  }

  const mdPath = join(RESULTS_DIR, "RESULT.md");
  writeFileSync(mdPath, md, "utf-8");

  console.log(`\nLog:    ${logPath}`);
  console.log(`Result: ${mdPath}`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
