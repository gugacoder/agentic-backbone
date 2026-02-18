#!/usr/bin/env node
/**
 * Test Conversation — Cron
 *
 * Tests cron scheduling via conversation. The agent receives a chat message,
 * schedules a cron job using cron_add, and when the cron fires the response
 * arrives back in the same conversation session.
 *
 * 10.1 — sem context: agent agenda cron_add, resposta chega na session
 * 10.2 — com context: agent agenda cron_add com context payload, resposta chega na session
 *
 * Usage:
 *   npm run test:capabilities:cron
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Config ──────────────────────────────────────────────────

if (!process.env.BACKBONE_PORT) {
  console.error("BACKBONE_PORT not set. Run: npm run test:capabilities:cron");
  process.exit(2);
}
if (!process.env.SYSUSER || !process.env.SYSPASS) {
  console.error("SYSUSER/SYSPASS not set. Run: npm run test:capabilities:cron");
  process.exit(2);
}

const BASE = `http://localhost:${process.env.BACKBONE_PORT}`;
const AGENT_ID = "system.probe";
const SEND_TIMEOUT_MS = 30_000;
const CRON_WAIT_MS = 60_000;

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

const RESULTS_DIR = join(process.cwd(), "test-results", "capabilities", `${SESSION_SLUG}-cron`);

// ── Fixed test reference ────────────────────────────────────

const TEST_REFERENCE = `## Cron (conversation)

| # | Capability | Prova |
|---|-----------|-------|
| 10.1 | Cron sem context | Usuário pede agendamento via chat. Na hora marcada, resposta chega na mesma session. |
| 10.2 | Cron com context | Idem, mas com context payload. Agente recebe o context de volta e extrai o valor. |`;

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

async function deleteSession(token, sessionId) {
  try {
    await fetch(`${BASE}/conversations/${sessionId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
  } catch {}
}

/**
 * Send a message to a conversation via SSE streaming endpoint.
 * Returns the full agent response text.
 */
async function sendMessage(token, sessionId, message) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

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

/**
 * Poll session messages until a matching message appears or timeout.
 */
async function waitForSessionMessage(token, sessionId, predicateFn, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/conversations/${sessionId}/messages`, {
        headers: authHeaders(token),
      });
      if (res.ok) {
        const messages = await res.json();
        const match = messages.find(predicateFn);
        if (match) return { match, messages };
      }
    } catch {}
    await sleep(1500);
  }
  return { match: null, messages: [] };
}

async function cleanupCronJob(token, agentId, slug) {
  try {
    await fetch(`${BASE}/cron/jobs/${agentId}/${slug}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
  } catch {}
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

  logLine("test-conversation-cron starting");
  logLine(`agent=${AGENT_ID}  base=${BASE}`);
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

  // ══════════════════════════════════════════════════════════
  // 10.1: Cron sem context
  // ══════════════════════════════════════════════════════════
  logLine("");
  logLine("═══ 10.1: Cron sem context ═══");
  const slug101 = "_probe_cron_noctx";
  let sessionId101 = null;
  try {
    await cleanupCronJob(token, AGENT_ID, slug101);

    const session = await createSession(token);
    sessionId101 = session.session_id;
    logLine(`session created: ${sessionId101}`);

    // Count messages before the cron fires (to distinguish later)
    const delaySeconds = 15;

    const atTime101 = new Date(Date.now() + (delaySeconds + 20) * 1000).toISOString();
    logLine(`sending message: natural language scheduling at ${atTime101}...`);
    const { fullText, timedOut } = await sendMessage(
      token,
      sessionId101,
      `Agenda pra mim um lembrete para ${atTime101}. Quando chegar a hora, responda com exatamente: CRON_NOCONTEXT_TOKEN_X1. Use o slug "${slug101}" e apague depois de executar.`,
    );

    if (timedOut) logLine(`A: (timeout after ${SEND_TIMEOUT_MS}ms)`);
    else logLine(`A: ${fullText.slice(0, 200)}`);

    dialog.push({
      question: "Schedule cron sem context",
      answer: fullText || null,
      status: timedOut ? "TIMEOUT" : fullText ? "OK" : "EMPTY",
    });

    // Verify cron was created
    const cronCheck = await fetch(`${BASE}/cron/jobs/${AGENT_ID}/${slug101}`, {
      headers: authHeaders(token),
    });
    const cronData = await cronCheck.json();

    if (cronData.error) {
      logLine(`cron job NOT created: ${cronData.error}`);
      capabilityResults.set("10.1", {
        name: "Cron sem context",
        state: "FAIL",
        notes: `Agent did not create cron job. Response: ${fullText.slice(0, 100)}`,
      });
    } else {
      logLine(`cron job created: payload=${JSON.stringify(cronData.def?.payload)}`);

      // Verify sessionId was auto-captured
      const hasSession = !!cronData.def?.payload?.sessionId;
      logLine(`sessionId captured: ${hasSession} (${cronData.def?.payload?.sessionId ?? "none"})`);

      // Now wait for the cron to fire and the response to appear in the session
      logLine(`waiting for cron response in session (up to ${CRON_WAIT_MS / 1000}s)...`);
      const { match, messages } = await waitForSessionMessage(
        token,
        sessionId101,
        // The cron turn creates a user message with [cron:slug] prefix,
        // then an assistant message with the response. Look for the assistant
        // message that follows a cron user message.
        (m) => m.role === "assistant" && (m.content ?? "").includes("CRON_NOCONTEXT_TOKEN_X1"),
        CRON_WAIT_MS,
      );

      if (match) {
        const cronUserMsg = messages.find(
          (m) => m.role === "user" && (m.content ?? "").includes(`[cron:${slug101}]`),
        );
        capabilityResults.set("10.1", {
          name: "Cron sem context",
          state: "PASS",
          notes: [
            `Token in session.`,
            cronUserMsg ? "Cron prompt persisted." : "Cron prompt NOT found.",
            `sessionId auto-captured: ${hasSession}.`,
            `Content: ${match.content.slice(0, 80)}`,
          ].join(" "),
        });
      } else {
        const assistantMsgs = messages.filter((m) => m.role === "assistant");
        const cronUserMsg = messages.find(
          (m) => m.role === "user" && (m.content ?? "").includes("[cron:"),
        );
        capabilityResults.set("10.1", {
          name: "Cron sem context",
          state: "FAIL",
          notes: [
            cronUserMsg ? "Cron prompt found but" : "No cron prompt —",
            `${assistantMsgs.length} assistant msg(s) total.`,
            assistantMsgs.length > 1
              ? `Last: ${assistantMsgs[assistantMsgs.length - 1].content?.slice(0, 80)}`
              : `sessionId captured: ${hasSession}`,
          ].join(" "),
        });
      }
    }
  } catch (err) {
    capabilityResults.set("10.1", { name: "Cron sem context", state: "FAIL", notes: err.message });
  } finally {
    await cleanupCronJob(token, AGENT_ID, slug101);
    if (sessionId101) await deleteSession(token, sessionId101);
  }
  logLine(`  [10.1] ${capabilityResults.get("10.1").state} — ${capabilityResults.get("10.1").notes}`);

  // ══════════════════════════════════════════════════════════
  // 10.2: Cron com context
  // ══════════════════════════════════════════════════════════
  logLine("");
  logLine("═══ 10.2: Cron com context ═══");
  const slug102 = "_probe_cron_ctx";
  let sessionId102 = null;
  try {
    await cleanupCronJob(token, AGENT_ID, slug102);

    const session = await createSession(token);
    sessionId102 = session.session_id;
    logLine(`session created: ${sessionId102}`);

    const delaySeconds = 15;
    const contextPayload = JSON.stringify({ task: "verify-context", secret: "CTX_SECRET_Z9" });

    const atTime102 = new Date(Date.now() + (delaySeconds + 20) * 1000).toISOString();
    logLine(`sending message: natural language scheduling with context at ${atTime102}...`);
    const { fullText, timedOut } = await sendMessage(
      token,
      sessionId102,
      `Salve na agenda uma tarefa para ${atTime102}. Quando chegar a hora, leia a tag cron_context, extraia o campo "secret" do JSON e responda com exatamente esse valor. Use o slug "${slug102}", apague depois de executar, e grave este context: ${contextPayload}`,
    );

    if (timedOut) logLine(`A: (timeout after ${SEND_TIMEOUT_MS}ms)`);
    else logLine(`A: ${fullText.slice(0, 200)}`);

    dialog.push({
      question: "Schedule cron com context",
      answer: fullText || null,
      status: timedOut ? "TIMEOUT" : fullText ? "OK" : "EMPTY",
    });

    // Verify cron was created
    const cronCheck = await fetch(`${BASE}/cron/jobs/${AGENT_ID}/${slug102}`, {
      headers: authHeaders(token),
    });
    const cronData = await cronCheck.json();

    if (cronData.error) {
      logLine(`cron job NOT created: ${cronData.error}`);
      capabilityResults.set("10.2", {
        name: "Cron com context",
        state: "FAIL",
        notes: `Agent did not create cron job. Response: ${fullText.slice(0, 100)}`,
      });
    } else {
      logLine(`cron job created: ${JSON.stringify(cronData.def?.payload)}`);

      const hasSession = !!cronData.def?.payload?.sessionId;
      const hasContext = !!cronData.def?.payload?.context;
      logLine(`sessionId captured: ${hasSession}, context captured: ${hasContext}`);

      logLine(`waiting for cron response in session (up to ${CRON_WAIT_MS / 1000}s)...`);
      const { match, messages } = await waitForSessionMessage(
        token,
        sessionId102,
        (m) => m.role === "assistant" && (m.content ?? "").includes("CTX_SECRET_Z9"),
        CRON_WAIT_MS,
      );

      if (match) {
        const cronUserMsg = messages.find(
          (m) => m.role === "user" && (m.content ?? "").includes("cron_context"),
        );
        capabilityResults.set("10.2", {
          name: "Cron com context",
          state: "PASS",
          notes: [
            `Secret in session.`,
            cronUserMsg ? "cron_context tag present." : "cron_context tag NOT found.",
            `context captured: ${hasContext}.`,
            `Content: ${match.content.slice(0, 80)}`,
          ].join(" "),
        });
      } else {
        const assistantMsgs = messages.filter((m) => m.role === "assistant");
        const cronUserMsg = messages.find(
          (m) => m.role === "user" && (m.content ?? "").includes("cron_context"),
        );
        capabilityResults.set("10.2", {
          name: "Cron com context",
          state: "FAIL",
          notes: [
            cronUserMsg ? "cron_context found but secret missing." : "No cron_context in messages.",
            `${assistantMsgs.length} assistant msg(s) total.`,
            hasContext ? "context was stored." : "context NOT stored.",
            assistantMsgs.length > 1
              ? `Last: ${assistantMsgs[assistantMsgs.length - 1].content?.slice(0, 80)}`
              : "",
          ].join(" "),
        });
      }
    }
  } catch (err) {
    capabilityResults.set("10.2", { name: "Cron com context", state: "FAIL", notes: err.message });
  } finally {
    await cleanupCronJob(token, AGENT_ID, slug102);
    if (sessionId102) await deleteSession(token, sessionId102);
  }
  logLine(`  [10.2] ${capabilityResults.get("10.2").state} — ${capabilityResults.get("10.2").notes}`);

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

  let md = `# Test Conversation — Cron\n\n`;
  md += `**Session:** ${SESSION_SLUG}  \n`;
  md += `**Agent:** ${AGENT_ID}  \n`;
  md += `**Date:** ${new Date().toISOString()}  \n`;
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
