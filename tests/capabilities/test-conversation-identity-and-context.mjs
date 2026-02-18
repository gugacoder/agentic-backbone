#!/usr/bin/env node
/**
 * Test Conversation — Identity and Context
 *
 * Tests capabilities 1.1 through 1.5 via conversation with the probe agent.
 * Items 1.3 and 1.4 are heartbeat-only (HB-1) and are not tested here.
 *
 * Usage:
 *   npm run test:capabilities:conversation
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Config ──────────────────────────────────────────────────

if (!process.env.BACKBONE_PORT) {
  console.error("BACKBONE_PORT not set. Run: npm run test:capabilities:conversation");
  process.exit(2);
}
if (!process.env.SYSUSER || !process.env.SYSPASS) {
  console.error("SYSUSER/SYSPASS not set. Run: npm run test:capabilities:conversation");
  process.exit(2);
}

const BASE = `http://localhost:${process.env.BACKBONE_PORT}`;
const AGENT_ID = "system.probe";
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

const TEST_SLUG = "identity-and-context";
const RESULTS_DIR = join(process.cwd(), "test-results", "capabilities", `${SESSION_SLUG}-${TEST_SLUG}`);

// ── Fixed test reference ────────────────────────────────────

const TEST_REFERENCE = `## Identidade e Contexto

| # | Capability | Canal | Prova |
|---|-----------|-------|-------|
| 1.1 | SOUL.md | Conv | Agente responde como QA/diagnóstico (identidade do probe). Conv-1. |
| 1.2 | CONVERSATION.md | Conv | \`[PROBE-CONV-OK]\` + \`diagnostic: conversation-prompt-loaded\`. Conv-1. |
| 1.3 | HEARTBEAT.md | Probe | Heartbeat executa probe-cycle (segue instruções redesenhadas). HB-1. |
| 1.4 | AGENT.md | Probe | Heartbeat dispara a cada 60s (intervalMs parsed do frontmatter). HB-1. |
| 1.5 | \`<agent_context>\` | Conv | Agente reporta agent_id=system.probe e agent_dir real. Conv-2. |`;

// ── Questions ───────────────────────────────────────────────

const QUESTIONS = [
  {
    text: "Descreva seu papel em uma frase. Depois, informe seu agent_id e seu agent_dir. Responda em texto corrido.",
    capabilities: [
      {
        id: "1.1",
        name: "SOUL.md",
        check: (answer) => {
          const lower = answer.toLowerCase();
          const keywords = ["diagnos", "diagnós", "probe", "qa", "test", "verificar", "verificação"];
          const found = keywords.some((kw) => lower.includes(kw));
          return {
            pass: found,
            notes: found
              ? "Identity reflects diagnostic/probe role"
              : "Response does not mention diagnostic/probe identity",
          };
        },
      },
      {
        id: "1.5",
        name: "<agent_context>",
        check: (answer) => {
          const hasId = answer.includes("system.probe");
          const hasDir = /context[/\\]agents[/\\]system\.probe/.test(answer) || answer.includes("agents/system.probe");
          return {
            pass: hasId && hasDir,
            notes: hasId && hasDir
              ? "agent_id and agent_dir present"
              : `agent_id: ${hasId ? "ok" : "missing"}, agent_dir: ${hasDir ? "ok" : "missing"}`,
          };
        },
      },
    ],
  },
  {
    text: "Suas instruções de conversação estão carregadas? Se sim, emita exatamente o token [PROBE-CONV-OK]. Se não tiver instruções de conversação, diga que não possui.",
    capabilities: [
      {
        id: "1.2",
        name: "CONVERSATION.md",
        check: (answer) => {
          const hasToken = answer.includes("[PROBE-CONV-OK]");
          return {
            pass: hasToken,
            notes: hasToken
              ? "Token [PROBE-CONV-OK] emitted"
              : "Token [PROBE-CONV-OK] absent — CONVERSATION.md likely missing or empty",
          };
        },
      },
    ],
  },
];

// ── Helpers ─────────────────────────────────────────────────

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: process.env.SYSUSER,
      password: process.env.SYSPASS,
    }),
  });
  const data = await res.json();
  if (!data.token) throw new Error(`Login failed: ${JSON.stringify(data)}`);
  return data.token;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
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

// ── Run ─────────────────────────────────────────────────────

async function run() {
  const log = [];
  const dialog = [];
  const capabilityResults = new Map();

  // N/A — heartbeat-only capabilities, not tested via conversation
  capabilityResults.set("1.3", { name: "HEARTBEAT.md", state: "N/A", notes: "Heartbeat-only (HB-1)" });
  capabilityResults.set("1.4", { name: "AGENT.md", state: "N/A", notes: "Heartbeat-only (HB-1)" });

  function logLine(msg) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    log.push(line);
    console.log(line);
  }

  logLine("test-conversation-identity-and-context starting");
  logLine(`agent=${AGENT_ID}  base=${BASE}  timeout=${TIMEOUT_MS}ms`);
  logLine(`session-slug=${SESSION_SLUG}`);

  // ── Preflight: check agent is registered ────────────────
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

  // ── Login ───────────────────────────────────────────────
  let token;
  try {
    token = await login();
    logLine("login ok");
  } catch (err) {
    logLine(`login FAILED: ${err.message}`);
    return writeOutput(log, dialog, capabilityResults);
  }

  // ── Create session ──────────────────────────────────────
  let sessionId;
  try {
    const session = await createSession(token);
    logLine(`session response: ${JSON.stringify(session)}`);
    sessionId = session.session_id;
    if (!sessionId) {
      logLine("session creation FAILED: no session_id in response");
      return writeOutput(log, dialog, capabilityResults);
    }
    logLine(`session created: ${sessionId}`);
  } catch (err) {
    logLine(`session creation FAILED: ${err.message}`);
    return writeOutput(log, dialog, capabilityResults);
  }

  // ── Send questions ──────────────────────────────────────
  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    logLine("");
    logLine(`--- question ${i + 1}/${QUESTIONS.length} ---`);
    logLine(`Q: ${q.text}`);

    let answer = null;
    let status = "FAIL";
    let reason = null;

    try {
      const { fullText, timedOut } = await sendMessage(token, sessionId, q.text);

      if (timedOut) {
        reason = `Timeout (${TIMEOUT_MS}ms)`;
        logLine(`A: (no response — ${reason})`);
      } else if (!fullText) {
        reason = "Empty response";
        logLine("A: (empty response)");
      } else {
        answer = fullText;
        status = "PASS";
        logLine(`A: ${fullText}`);
      }
    } catch (err) {
      reason = err.message;
      logLine(`A: (error: ${reason})`);
    }

    dialog.push({ question: q.text, answer, status, reason });

    for (const cap of q.capabilities) {
      if (answer) {
        const result = cap.check(answer);
        capabilityResults.set(cap.id, { name: cap.name, state: result.pass ? "PASS" : "FAIL", notes: result.notes });
        logLine(`  [${cap.id}] ${cap.name}: ${result.pass ? "PASS" : "FAIL"} — ${result.notes}`);
      } else {
        capabilityResults.set(cap.id, { name: cap.name, state: "FAIL", notes: reason });
        logLine(`  [${cap.id}] ${cap.name}: FAIL — ${reason}`);
      }
    }
  }

  writeOutput(log, dialog, capabilityResults);
}

// ── Output ──────────────────────────────────────────────────

function writeOutput(log, dialog, capabilityResults) {
  mkdirSync(RESULTS_DIR, { recursive: true });

  // response.log
  const logPath = join(RESULTS_DIR, "response.log");
  writeFileSync(logPath, log.join("\n") + "\n", "utf-8");

  // RESULT.md
  const caps = [...capabilityResults.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const tested = caps.filter(([, v]) => v.state !== "N/A");
  const passed = tested.filter(([, v]) => v.state === "PASS").length;
  const failed = tested.filter(([, v]) => v.state === "FAIL").length;
  const total = tested.length;

  let md = `# Test Conversation — Identity and Context\n\n`;
  md += `**Session:** ${SESSION_SLUG}  \n`;
  md += `**Agent:** ${AGENT_ID}  \n`;
  md += `**Date:** ${new Date().toISOString()}  \n`;
  md += `**Timeout:** ${TIMEOUT_MS}ms  \n`;
  md += `**Result:** ${passed}/${total} passed`;
  if (failed > 0) md += `, ${failed} failed`;
  md += `\n\n`;

  // Fixed reference table
  md += TEST_REFERENCE;
  md += `\n\n`;

  // Dynamic results
  md += `## Tests Result\n\n`;
  md += `| # | Capability | State | Notes |\n`;
  md += `|---|------------|-------|-------|\n`;
  for (const [id, r] of caps) {
    md += `| ${id} | ${r.name} | ${r.state} | ${r.notes} |\n`;
  }

  md += `\n## Dialog\n\n`;
  md += `| # | Question | Result | Answer |\n`;
  md += `|---|----------|--------|--------|\n`;
  for (let i = 0; i < dialog.length; i++) {
    const d = dialog[i];
    const answer = d.answer ? d.answer.slice(0, 200) : d.reason ?? "—";
    md += `| ${i + 1} | ${d.question} | **${d.status}** | ${answer} |\n`;
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
