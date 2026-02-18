#!/usr/bin/env node
/**
 * Test Conversation — Hooks
 *
 * Tests hook capabilities (8.x) by installing a temporary test hook,
 * reloading via POST /system/refresh, sending a conversation message,
 * and checking which hook events actually fired via a marker file.
 *
 * Usage:
 *   npm run test:capabilities:hooks
 */

import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

// ── Config ──────────────────────────────────────────────────

if (!process.env.BACKBONE_PORT) {
  console.error("BACKBONE_PORT not set. Run: npm run test:capabilities:hooks");
  process.exit(2);
}
if (!process.env.SYSUSER || !process.env.SYSPASS) {
  console.error("SYSUSER/SYSPASS not set. Run: npm run test:capabilities:hooks");
  process.exit(2);
}
if (!process.env.CONTEXT_FOLDER) {
  console.error("CONTEXT_FOLDER not set. Run: npm run test:capabilities:hooks");
  process.exit(2);
}

const BASE = `http://localhost:${process.env.BACKBONE_PORT}`;
const AGENT_ID = "system.probe";
const TIMEOUT_MS = 30_000;
const CONTEXT = process.env.CONTEXT_FOLDER;

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

const RESULTS_DIR = join(process.cwd(), "test-results", "capabilities", `${SESSION_SLUG}-hooks`);

// ── Fixed test reference ────────────────────────────────────

const TEST_REFERENCE = `## Hooks

| # | Capability | Canal | Prova |
|---|-----------|-------|-------|
| 8.1 | Hook discovery | REST | Hook aparece em GET /system/hooks após POST /system/refresh. |
| 8.2 | message:received | Conv | Hook dispara quando usuário envia mensagem. Marker gravado. |
| 8.3 | message:sent | Conv | Hook dispara quando agente responde. Marker gravado. |`;

// ── Test hook content ───────────────────────────────────────

const HOOK_DIR = join(CONTEXT, "shared", "hooks", "test-probe");
const HOOK_MD = `---
name: test-probe
description: Hook de teste — grava marker quando eventos de conversação disparam
events: message:received, message:sent, agent:before, agent:after
priority: 99
enabled: true
---

# Test Probe Hook

Grava uma linha JSONL em marker.jsonl a cada evento disparado.
`;

const HOOK_HANDLER = `import { appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MARKER = join(__dirname, "marker.jsonl");

export default async function(ctx) {
  const line = JSON.stringify({ event: ctx.hookEvent, ts: ctx.ts }) + "\\n";
  appendFileSync(MARKER, line, "utf-8");
}
`;

const MARKER_PATH = join(HOOK_DIR, "marker.jsonl");

// ── Hook file management ────────────────────────────────────

function installHook() {
  mkdirSync(HOOK_DIR, { recursive: true });
  writeFileSync(join(HOOK_DIR, "HOOK.md"), HOOK_MD, "utf-8");
  writeFileSync(join(HOOK_DIR, "handler.mjs"), HOOK_HANDLER, "utf-8");
  // Clear any previous marker
  if (existsSync(MARKER_PATH)) rmSync(MARKER_PATH);
}

function removeHook() {
  if (existsSync(HOOK_DIR)) rmSync(HOOK_DIR, { recursive: true });
}

function readMarker() {
  if (!existsSync(MARKER_PATH)) return [];
  const raw = readFileSync(MARKER_PATH, "utf-8").trim();
  if (!raw) return [];
  return raw.split("\n").map((line) => {
    try { return JSON.parse(line); }
    catch { return null; }
  }).filter(Boolean);
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

  logLine("test-conversation-hooks starting");
  logLine(`agent=${AGENT_ID}  base=${BASE}  timeout=${TIMEOUT_MS}ms`);
  logLine(`session-slug=${SESSION_SLUG}`);
  logLine(`hook dir=${HOOK_DIR}`);

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

  // ── Install test hook ──────────────────────────────────────
  try {
    installHook();
    logLine("test hook installed");
  } catch (err) {
    logLine(`hook install FAILED: ${err.message}`);
    return writeOutput(log, dialog, capabilityResults);
  }

  try {
    // ── Reload hooks via POST /system/refresh ──────────────
    logLine("calling POST /system/refresh to reload hooks...");
    const refreshRes = await fetch(`${BASE}/system/refresh`, {
      method: "POST",
      headers: authHeaders(token),
    });
    const refreshData = await refreshRes.json();
    logLine(`refresh response: ${JSON.stringify(refreshData)}`);

    // ── 8.1: Hook discovery ─────────────────────────────────
    logLine("");
    logLine("═══ 8.1: Hook discovery ═══");
    try {
      const hooksRes = await fetch(`${BASE}/system/hooks`, { headers: authHeaders(token) });
      const hooksData = await hooksRes.json();
      logLine(`hooks snapshot: ${JSON.stringify(hooksData)}`);

      const testHook = (hooksData.hooks ?? []).find((h) => h.slug === "test-probe");
      if (testHook && testHook.loaded && testHook.enabled) {
        capabilityResults.set("8.1", {
          name: "Hook discovery",
          state: "PASS",
          notes: `Hook test-probe loaded. Events: ${testHook.events?.join(", ")}`,
        });
      } else if (testHook) {
        capabilityResults.set("8.1", {
          name: "Hook discovery",
          state: "FAIL",
          notes: `Hook found but not active. loaded=${testHook.loaded}, enabled=${testHook.enabled}, error=${testHook.error ?? "none"}`,
        });
      } else {
        capabilityResults.set("8.1", {
          name: "Hook discovery",
          state: "FAIL",
          notes: `Hook test-probe not found in /system/hooks (${hooksData.total ?? 0} total hooks)`,
        });
      }
    } catch (err) {
      capabilityResults.set("8.1", { name: "Hook discovery", state: "FAIL", notes: err.message });
    }
    logLine(`  [8.1] ${capabilityResults.get("8.1").state} — ${capabilityResults.get("8.1").notes}`);

    // ── Send conversation message ────────────────────────────
    logLine("");
    logLine("═══ 8.2 + 8.3: Hook events via conversation ═══");

    let sessionId;
    try {
      const session = await createSession(token);
      sessionId = session.session_id;
      logLine(`session created: ${sessionId}`);
    } catch (err) {
      logLine(`session creation FAILED: ${err.message}`);
    }

    if (sessionId) {
      logLine("sending message...");
      const { fullText, timedOut } = await sendMessage(
        token,
        sessionId,
        "Qual é a data de hoje? Responda apenas a data.",
      );

      if (timedOut) logLine(`A: (timeout ${TIMEOUT_MS}ms)`);
      else logLine(`A: ${fullText.slice(0, 200)}`);

      dialog.push({
        question: "Qual é a data de hoje?",
        answer: fullText || null,
        status: timedOut ? "TIMEOUT" : fullText ? "OK" : "EMPTY",
      });

      // Wait a moment for hooks to finish writing
      await sleep(1000);

      // Read marker file
      const markers = readMarker();
      const eventNames = markers.map((m) => m.event);
      logLine(`marker entries: ${markers.length}`);
      logLine(`events fired: [${eventNames.join(", ")}]`);

      // ── 8.2: message:received ───────────────────────────
      const hasReceived = eventNames.includes("message:received");
      capabilityResults.set("8.2", {
        name: "message:received",
        state: hasReceived ? "PASS" : "FAIL",
        notes: hasReceived
          ? "Hook fired on message:received"
          : `Hook did not fire. Events found: [${eventNames.join(", ") || "none"}]`,
      });

      // ── 8.3: message:sent ──────────────────────────────
      const hasSent = eventNames.includes("message:sent");
      capabilityResults.set("8.3", {
        name: "message:sent",
        state: hasSent ? "PASS" : "FAIL",
        notes: hasSent
          ? "Hook fired on message:sent"
          : timedOut
            ? `Conversation timed out — agent may not have finished (message:sent fires after response)`
            : `Hook did not fire. Events found: [${eventNames.join(", ") || "none"}]`,
      });
    } else {
      capabilityResults.set("8.2", { name: "message:received", state: "FAIL", notes: "Could not create session" });
      capabilityResults.set("8.3", { name: "message:sent", state: "FAIL", notes: "Could not create session" });
    }

    logLine(`  [8.2] ${capabilityResults.get("8.2").state} — ${capabilityResults.get("8.2").notes}`);
    logLine(`  [8.3] ${capabilityResults.get("8.3").state} — ${capabilityResults.get("8.3").notes}`);

  } finally {
    // ── Cleanup ────────────────────────────────────────────
    removeHook();
    logLine("");
    logLine("test hook removed");

    // Reload hooks again to remove test hook from registry
    try {
      await fetch(`${BASE}/system/refresh`, {
        method: "POST",
        headers: authHeaders(token),
      });
      logLine("hooks reloaded (cleanup)");
    } catch {}
  }

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

  let md = `# Test Conversation — Hooks\n\n`;
  md += `**Session:** ${SESSION_SLUG}  \n`;
  md += `**Agent:** ${AGENT_ID}  \n`;
  md += `**Date:** ${new Date().toISOString()}  \n`;
  md += `**Timeout:** ${TIMEOUT_MS}ms  \n`;
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
