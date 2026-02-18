#!/usr/bin/env node
/**
 * Test Conversation — Tools
 *
 * Tests capabilities 3.1 and 3.3 via conversation with the probe agent.
 * Creates temporary test tools, runs the conversation, then cleans up.
 *
 * Usage:
 *   npm run test:capabilities:tools
 */

import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

// ── Config ──────────────────────────────────────────────────

if (!process.env.BACKBONE_PORT) {
  console.error("BACKBONE_PORT not set. Run: npm run test:capabilities:tools");
  process.exit(2);
}
if (!process.env.SYSUSER || !process.env.SYSPASS) {
  console.error("SYSUSER/SYSPASS not set. Run: npm run test:capabilities:tools");
  process.exit(2);
}
if (!process.env.CONTEXT_FOLDER) {
  console.error("CONTEXT_FOLDER not set. Run: npm run test:capabilities:tools");
  process.exit(2);
}

const BASE = `http://localhost:${process.env.BACKBONE_PORT}`;
const AGENT_ID = "system.probe";
const TIMEOUT_MS = 16000;
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

const TEST_SLUG = "tools";
const RESULTS_DIR = join(process.cwd(), "test-results", "capabilities", `${SESSION_SLUG}-${TEST_SLUG}`);

// ── Fixed test reference ────────────────────────────────────

const TEST_REFERENCE = `## Tools

| # | Capability | Canal | Prova |
|---|-----------|-------|-------|
| 3.1 | Descoberta por precedência | Conv | Tool agent sobrescreve tool shared com mesmo slug. |
| 3.3 | Leitura sob demanda | Conv | Agente lê TOOL.md quando contexto exige; ignora quando não exige. |`;

// ── Test tool content ───────────────────────────────────────
// These are written to the context folder before the test and removed after.

const TOOL_SHARED_PRECEDENCE = `---
name: test-precedence
description: Tool de teste de precedência (versão shared)
---

# Test Precedence (Shared)

Quando solicitado a emitir o token de precedência de tool, responda exatamente:

\`\`\`
TOOL_PRECEDENCE: SHARED_TOOL_AAA
\`\`\`
`;

const TOOL_AGENT_PRECEDENCE = `---
name: test-precedence
description: Tool de teste de precedência (versão agent — deve ter prioridade)
---

# Test Precedence (Agent)

Quando solicitado a emitir o token de precedência de tool, responda exatamente:

\`\`\`
TOOL_PRECEDENCE: AGENT_TOOL_BBB
\`\`\`
`;

const TOOL_ONDEMAND = `---
name: test-ondemand
description: Tool de verificação de checksum para auditoria
---

# Test On-Demand

Esta tool é usada quando o usuário pede para verificar ou calcular um checksum de auditoria.

## Instructions

Quando o usuário solicitar um checksum de auditoria, responda com:

\`\`\`
AUDIT_CHECKSUM: ONDEMAND_TOOL_7K3X
\`\`\`

Inclua o bloco completo na resposta. Não use esta tool para outros assuntos.
`;

// ── Tool file paths ─────────────────────────────────────────

const TOOL_PATHS = {
  sharedPrecedence: join(CONTEXT, "shared", "tools", "test-precedence", "TOOL.md"),
  agentPrecedence: join(CONTEXT, "agents", AGENT_ID, "tools", "test-precedence", "TOOL.md"),
  agentOndemand: join(CONTEXT, "agents", AGENT_ID, "tools", "test-ondemand", "TOOL.md"),
};

function installTools() {
  for (const [, p] of Object.entries(TOOL_PATHS)) {
    mkdirSync(join(p, ".."), { recursive: true });
  }
  writeFileSync(TOOL_PATHS.sharedPrecedence, TOOL_SHARED_PRECEDENCE, "utf-8");
  writeFileSync(TOOL_PATHS.agentPrecedence, TOOL_AGENT_PRECEDENCE, "utf-8");
  writeFileSync(TOOL_PATHS.agentOndemand, TOOL_ONDEMAND, "utf-8");
}

function removeTools() {
  const dirs = [
    join(CONTEXT, "shared", "tools", "test-precedence"),
    join(CONTEXT, "agents", AGENT_ID, "tools", "test-precedence"),
    join(CONTEXT, "agents", AGENT_ID, "tools", "test-ondemand"),
  ];
  for (const dir of dirs) {
    if (existsSync(dir)) rmSync(dir, { recursive: true });
  }
}

// ── Questions ───────────────────────────────────────────────

const QUESTIONS = [
  // 3.3 — Part 1: Do NOT provoke the tool. Agent should NOT emit the token.
  {
    text: "Qual é a data de hoje? Responda apenas a data.",
    capabilities: [
      {
        id: "3.3a",
        name: "Leitura sob demanda (não provocada)",
        check: (answer) => {
          const leaked = answer.includes("ONDEMAND_TOOL_7K3X");
          return {
            pass: !leaked,
            notes: leaked
              ? "Agent emitted on-demand token without being asked — tool leak"
              : "Agent did not use the on-demand tool (correct)",
          };
        },
      },
    ],
  },
  // 3.3 — Part 2: Provoke the tool. Agent SHOULD emit the token.
  {
    text: "Preciso que você calcule o checksum de auditoria. Execute a tool correspondente.",
    capabilities: [
      {
        id: "3.3b",
        name: "Leitura sob demanda (provocada)",
        check: (answer) => {
          const found = answer.includes("ONDEMAND_TOOL_7K3X");
          return {
            pass: found,
            notes: found
              ? "Agent read and executed the on-demand tool"
              : "Agent did not emit the on-demand token — tool not read",
          };
        },
      },
    ],
  },
  // 3.1 — Precedence: agent tool should override shared tool
  {
    text: "Emita o token de precedência conforme sua tool test-precedence.",
    capabilities: [
      {
        id: "3.1",
        name: "Descoberta por precedência",
        check: (answer) => {
          const hasAgent = answer.includes("AGENT_TOOL_BBB");
          const hasShared = answer.includes("SHARED_TOOL_AAA");
          if (hasAgent && !hasShared) {
            return { pass: true, notes: "Agent-level tool took precedence over shared" };
          }
          if (hasShared && !hasAgent) {
            return { pass: false, notes: "Shared tool used instead of agent — precedence broken" };
          }
          if (hasAgent && hasShared) {
            return { pass: false, notes: "Both tokens present — precedence unclear" };
          }
          return { pass: false, notes: "Neither token found — tool not read" };
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
    body: JSON.stringify({ username: process.env.SYSUSER, password: process.env.SYSPASS }),
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

  function logLine(msg) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    log.push(line);
    console.log(line);
  }

  logLine("test-conversation-tools starting");
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

  // ── Install test tools ──────────────────────────────────
  try {
    installTools();
    logLine("test tools installed");
  } catch (err) {
    logLine(`tool install FAILED: ${err.message}`);
    return writeOutput(log, dialog, capabilityResults);
  }

  try {
    // ── Login ─────────────────────────────────────────────
    let token;
    try {
      token = await login();
      logLine("login ok");
    } catch (err) {
      logLine(`login FAILED: ${err.message}`);
      return writeOutput(log, dialog, capabilityResults);
    }

    // ── Create session ────────────────────────────────────
    let sessionId;
    try {
      const session = await createSession(token);
      sessionId = session.session_id;
      if (!sessionId) {
        logLine(`session creation FAILED: ${JSON.stringify(session)}`);
        return writeOutput(log, dialog, capabilityResults);
      }
      logLine(`session created: ${sessionId}`);
    } catch (err) {
      logLine(`session creation FAILED: ${err.message}`);
      return writeOutput(log, dialog, capabilityResults);
    }

    // ── Send questions ────────────────────────────────────
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
  } finally {
    // ── Cleanup test tools ────────────────────────────────
    removeTools();
    logLine("");
    logLine("test tools removed");
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

  let md = `# Test Conversation — Tools\n\n`;
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

// ── Resources ───────────────────────────────────────────────
//
// Test tools created temporarily in the context folder:
//
// 1. context/shared/tools/test-precedence/TOOL.md
//    Shared version with token SHARED_TOOL_AAA
//
// 2. context/agents/system.probe/tools/test-precedence/TOOL.md
//    Agent version with token AGENT_TOOL_BBB (should win over shared)
//
// 3. context/agents/system.probe/tools/test-ondemand/TOOL.md
//    On-demand tool with token ONDEMAND_TOOL_7K3X
//    Triggered only when user asks for "checksum de auditoria"
//
// All test tools are prefixed with "test-" and removed after the test.
