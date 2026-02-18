#!/usr/bin/env node
/**
 * Test Conversation — Memory
 *
 * Tests capabilities 5.1 through 5.5 via conversation with the probe agent.
 * Uses separate sessions per capability group (Conv-5 through Conv-8).
 * Items 5.5 are implicit — tested via 5.1 (memory_save), 5.2 (memory_journal), 5.3 (memory_search).
 *
 * Usage:
 *   npm run test:capabilities:memory
 */

import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// ── Config ──────────────────────────────────────────────────

if (!process.env.BACKBONE_PORT) {
  console.error("BACKBONE_PORT not set. Run: npm run test:capabilities:memory");
  process.exit(2);
}
if (!process.env.SYSUSER || !process.env.SYSPASS) {
  console.error("SYSUSER/SYSPASS not set. Run: npm run test:capabilities:memory");
  process.exit(2);
}
if (!process.env.CONTEXT_FOLDER) {
  console.error("CONTEXT_FOLDER not set. Run: npm run test:capabilities:memory");
  process.exit(2);
}

const BASE = `http://localhost:${process.env.BACKBONE_PORT}`;
const AGENT_ID = "system.probe";
const TIMEOUT_MS = 16_000;
const CONTEXT = resolve(process.cwd(), process.env.CONTEXT_FOLDER);

const MEMORY_TOKEN = "CAPABILITY_TEST_TOKEN_2026";
const JOURNAL_TOKEN = "JOURNAL_PROBE_ENTRY_X9";

const today = new Date();
const TODAY_STR = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0"),
].join("-");

const MEMORY_PATH = join(CONTEXT, "agents", AGENT_ID, "MEMORY.md");
const JOURNAL_PATH = join(CONTEXT, "agents", AGENT_ID, "journal", TODAY_STR, "MEMORY.md");

const FLUSH_EVERY = process.env.MEMORY_FLUSH_EVERY
  ? parseInt(process.env.MEMORY_FLUSH_EVERY, 10)
  : null;

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

const TEST_SLUG = "memory";
const RESULTS_DIR = join(process.cwd(), "test-results", "capabilities", `${SESSION_SLUG}-${TEST_SLUG}`);

// ── Fixed test reference ────────────────────────────────────

const TEST_REFERENCE = `## Memória

| # | Capability | Canal | Prova |
|---|-----------|-------|-------|
| 5.1 | MEMORY.md | Conv | Escreve + lê \`${MEMORY_TOKEN}\`. |
| 5.2 | Journal | Conv | Cria \`journal/${TODAY_STR}/MEMORY.md\`, lê de volta. |
| 5.3 | Semantic search | Conv | Após save, agente "lembra" do token via \`<relevant_memories>\`. |
| 5.4 | Memory flush | Conv | Após MEMORY_FLUSH_EVERY msgs, verificar MEMORY.md atualizado pelo flush. |
| 5.5 | Memory tools | Conv | memory_save (5.1), memory_journal (5.2), memory_search (5.3). |`;

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

function readFileSafe(path) {
  return existsSync(path) ? readFileSync(path, "utf-8") : null;
}

function fileMtime(path) {
  return existsSync(path) ? statSync(path).mtimeMs : null;
}

// ── Backup / Restore ────────────────────────────────────────

let memoryBackup = null;
let journalExistedBefore = false;

function backupState() {
  memoryBackup = readFileSafe(MEMORY_PATH);
  journalExistedBefore = existsSync(JOURNAL_PATH);
}

function restoreState() {
  // Restore MEMORY.md to original content (remove test tokens)
  if (memoryBackup !== null) {
    const current = readFileSafe(MEMORY_PATH);
    if (current && current.includes(MEMORY_TOKEN)) {
      const cleaned = current
        .split("\n")
        .filter((line) => !line.includes(MEMORY_TOKEN))
        .join("\n");
      writeFileSync(MEMORY_PATH, cleaned, "utf-8");
    }
  }

  // Remove test journal entry if it was created by the test
  if (!journalExistedBefore && existsSync(JOURNAL_PATH)) {
    const content = readFileSafe(JOURNAL_PATH);
    if (content && content.includes(JOURNAL_TOKEN)) {
      const journalDir = join(JOURNAL_PATH, "..");
      rmSync(journalDir, { recursive: true });
    }
  }
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

  logLine("test-conversation-memory starting");
  logLine(`agent=${AGENT_ID}  base=${BASE}  timeout=${TIMEOUT_MS}ms`);
  logLine(`session-slug=${SESSION_SLUG}`);
  logLine(`memory-path=${MEMORY_PATH}`);
  logLine(`journal-path=${JOURNAL_PATH}`);
  logLine(`MEMORY_FLUSH_EVERY=${FLUSH_EVERY ?? "not set (default 20)"}`);
  logLine(`OPENAI_API_KEY=${process.env.OPENAI_API_KEY ? "set" : "not set"}`);

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

  backupState();
  logLine(`backup ok — MEMORY.md ${memoryBackup !== null ? "exists" : "absent"}, journal ${journalExistedBefore ? "exists" : "absent"}`);

  let token;
  try {
    token = await login();
    logLine("login ok");
  } catch (err) {
    logLine(`login FAILED: ${err.message}`);
    return writeOutput(log, dialog, capabilityResults);
  }

  try {
    // ── Session 1 (Conv-5): 5.1 MEMORY.md + 5.5 memory-save ──
    logLine("");
    logLine("═══ Session 1: MEMORY.md (5.1 + 5.5 memory_save) ═══");
    {
      const session = await createSession(token);
      if (!session.session_id) {
        logLine(`session creation FAILED: ${JSON.stringify(session)}`);
        capabilityResults.set("5.1", { name: "MEMORY.md", state: "FAIL", notes: "Session creation failed" });
        capabilityResults.set("5.5a", { name: "memory_save tool", state: "FAIL", notes: "Session creation failed" });
      } else {
        logLine(`session created: ${session.session_id}`);

        // Q1: Save token
        logLine("");
        logLine("--- 5.1 save ---");
        const q1Text = `Salve exatamente o seguinte texto no seu MEMORY.md: ${MEMORY_TOKEN}. Use a tool memory_save. Confirme o que salvou.`;
        logLine(`Q: ${q1Text}`);
        const r1 = await sendMessage(token, session.session_id, q1Text);
        let q1Answer = null;
        if (r1.timedOut) {
          logLine(`A: (no response — Timeout (${TIMEOUT_MS}ms))`);
        } else if (!r1.fullText) {
          logLine("A: (empty response)");
        } else {
          q1Answer = r1.fullText;
          logLine(`A: ${r1.fullText}`);
        }
        dialog.push({ question: q1Text, answer: q1Answer, status: q1Answer ? "PASS" : "FAIL", reason: r1.timedOut ? `Timeout (${TIMEOUT_MS}ms)` : (!r1.fullText ? "Empty response" : null) });

        // Q2: Read back
        logLine("");
        logLine("--- 5.1 read ---");
        const q2Text = `Releia seu MEMORY.md agora. O token ${MEMORY_TOKEN} está presente? Mostre o conteúdo relevante.`;
        logLine(`Q: ${q2Text}`);
        const r2 = await sendMessage(token, session.session_id, q2Text);
        let q2Answer = null;
        if (r2.timedOut) {
          logLine(`A: (no response — Timeout (${TIMEOUT_MS}ms))`);
        } else if (!r2.fullText) {
          logLine("A: (empty response)");
        } else {
          q2Answer = r2.fullText;
          logLine(`A: ${r2.fullText}`);
        }
        dialog.push({ question: q2Text, answer: q2Answer, status: q2Answer ? "PASS" : "FAIL", reason: r2.timedOut ? `Timeout (${TIMEOUT_MS}ms)` : (!r2.fullText ? "Empty response" : null) });

        // Evaluate 5.1: conversation check
        const convHasToken = (q1Answer && q1Answer.includes(MEMORY_TOKEN)) || (q2Answer && q2Answer.includes(MEMORY_TOKEN));
        // Evaluate 5.1: filesystem check
        const memContent = readFileSafe(MEMORY_PATH);
        const fsHasToken = memContent && memContent.includes(MEMORY_TOKEN);

        if (convHasToken && fsHasToken) {
          capabilityResults.set("5.1", { name: "MEMORY.md", state: "PASS", notes: "Token confirmed in conversation and filesystem" });
        } else if (fsHasToken) {
          capabilityResults.set("5.1", { name: "MEMORY.md", state: "PASS", notes: "Token found in filesystem (conversation did not confirm)" });
        } else if (convHasToken) {
          capabilityResults.set("5.1", { name: "MEMORY.md", state: "FAIL", notes: "Agent claims saved but token not found in MEMORY.md" });
        } else {
          const reason = r1.timedOut ? `Timeout (${TIMEOUT_MS}ms)` : "Token not found in conversation or filesystem";
          capabilityResults.set("5.1", { name: "MEMORY.md", state: "FAIL", notes: reason });
        }
        logLine(`  [5.1] MEMORY.md: ${capabilityResults.get("5.1").state} — ${capabilityResults.get("5.1").notes}`);

        // 5.5a: memory_save tool usage is implicit in 5.1
        const save51 = capabilityResults.get("5.1");
        capabilityResults.set("5.5a", { name: "memory_save tool", state: save51.state, notes: `Implicit in 5.1: ${save51.notes}` });
        logLine(`  [5.5a] memory_save tool: ${save51.state}`);
      }
    }

    // ── Session 2 (Conv-6): 5.2 Journal + 5.5 memory-journal ──
    logLine("");
    logLine("═══ Session 2: Journal (5.2 + 5.5 memory_journal) ═══");
    {
      const session = await createSession(token);
      if (!session.session_id) {
        logLine(`session creation FAILED: ${JSON.stringify(session)}`);
        capabilityResults.set("5.2", { name: "Journal", state: "FAIL", notes: "Session creation failed" });
        capabilityResults.set("5.5b", { name: "memory_journal tool", state: "FAIL", notes: "Session creation failed" });
      } else {
        logLine(`session created: ${session.session_id}`);

        // Q1: Write journal
        logLine("");
        logLine("--- 5.2 write ---");
        const q1Text = `Registre no seu journal de hoje exatamente: ${JOURNAL_TOKEN}. Use a tool memory_journal. Confirme o que registrou.`;
        logLine(`Q: ${q1Text}`);
        const r1 = await sendMessage(token, session.session_id, q1Text);
        let q1Answer = null;
        if (r1.timedOut) {
          logLine(`A: (no response — Timeout (${TIMEOUT_MS}ms))`);
        } else if (!r1.fullText) {
          logLine("A: (empty response)");
        } else {
          q1Answer = r1.fullText;
          logLine(`A: ${r1.fullText}`);
        }
        dialog.push({ question: q1Text, answer: q1Answer, status: q1Answer ? "PASS" : "FAIL", reason: r1.timedOut ? `Timeout (${TIMEOUT_MS}ms)` : (!r1.fullText ? "Empty response" : null) });

        // Q2: Read journal back
        logLine("");
        logLine("--- 5.2 read ---");
        const q2Text = `Releia seu journal de hoje. A entrada ${JOURNAL_TOKEN} está presente? Mostre o conteúdo relevante.`;
        logLine(`Q: ${q2Text}`);
        const r2 = await sendMessage(token, session.session_id, q2Text);
        let q2Answer = null;
        if (r2.timedOut) {
          logLine(`A: (no response — Timeout (${TIMEOUT_MS}ms))`);
        } else if (!r2.fullText) {
          logLine("A: (empty response)");
        } else {
          q2Answer = r2.fullText;
          logLine(`A: ${r2.fullText}`);
        }
        dialog.push({ question: q2Text, answer: q2Answer, status: q2Answer ? "PASS" : "FAIL", reason: r2.timedOut ? `Timeout (${TIMEOUT_MS}ms)` : (!r2.fullText ? "Empty response" : null) });

        // Evaluate 5.2
        const convHasToken = (q1Answer && q1Answer.includes(JOURNAL_TOKEN)) || (q2Answer && q2Answer.includes(JOURNAL_TOKEN));
        const journalContent = readFileSafe(JOURNAL_PATH);
        const fsHasToken = journalContent && journalContent.includes(JOURNAL_TOKEN);

        if (convHasToken && fsHasToken) {
          capabilityResults.set("5.2", { name: "Journal", state: "PASS", notes: "Entry confirmed in conversation and filesystem" });
        } else if (fsHasToken) {
          capabilityResults.set("5.2", { name: "Journal", state: "PASS", notes: "Entry found in filesystem (conversation did not confirm)" });
        } else if (convHasToken) {
          capabilityResults.set("5.2", { name: "Journal", state: "FAIL", notes: "Agent claims journaled but entry not found in filesystem" });
        } else {
          const reason = r1.timedOut ? `Timeout (${TIMEOUT_MS}ms)` : "Entry not found in conversation or filesystem";
          capabilityResults.set("5.2", { name: "Journal", state: "FAIL", notes: reason });
        }
        logLine(`  [5.2] Journal: ${capabilityResults.get("5.2").state} — ${capabilityResults.get("5.2").notes}`);

        const save52 = capabilityResults.get("5.2");
        capabilityResults.set("5.5b", { name: "memory_journal tool", state: save52.state, notes: `Implicit in 5.2: ${save52.notes}` });
        logLine(`  [5.5b] memory_journal tool: ${save52.state}`);
      }
    }

    // ── Session 3 (Conv-7): 5.3 Semantic search + 5.5 memory-recall ──
    logLine("");
    logLine("═══ Session 3: Semantic search (5.3 + 5.5 memory_search) ═══");
    if (!process.env.OPENAI_API_KEY) {
      logLine("SKIP — OPENAI_API_KEY not set (required for embeddings)");
      capabilityResults.set("5.3", { name: "Semantic search", state: "N/A", notes: "OPENAI_API_KEY not set" });
      capabilityResults.set("5.5c", { name: "memory_search tool", state: "N/A", notes: "OPENAI_API_KEY not set" });
    } else {
      const session = await createSession(token);
      if (!session.session_id) {
        logLine(`session creation FAILED: ${JSON.stringify(session)}`);
        capabilityResults.set("5.3", { name: "Semantic search", state: "FAIL", notes: "Session creation failed" });
        capabilityResults.set("5.5c", { name: "memory_search tool", state: "FAIL", notes: "Session creation failed" });
      } else {
        logLine(`session created: ${session.session_id}`);

        logLine("");
        logLine("--- 5.3 recall ---");
        const qText = `Use a tool memory_search para buscar "capability test token". Retorne o valor exato do token encontrado.`;
        logLine(`Q: ${qText}`);
        const r = await sendMessage(token, session.session_id, qText);
        let answer = null;
        if (r.timedOut) {
          logLine(`A: (no response — Timeout (${TIMEOUT_MS}ms))`);
        } else if (!r.fullText) {
          logLine("A: (empty response)");
        } else {
          answer = r.fullText;
          logLine(`A: ${r.fullText}`);
        }
        dialog.push({ question: qText, answer, status: answer ? "PASS" : "FAIL", reason: r.timedOut ? `Timeout (${TIMEOUT_MS}ms)` : (!r.fullText ? "Empty response" : null) });

        const recalled = answer && answer.includes(MEMORY_TOKEN);
        if (recalled) {
          capabilityResults.set("5.3", { name: "Semantic search", state: "PASS", notes: `Agent recalled ${MEMORY_TOKEN} via semantic search` });
        } else {
          const reason = r.timedOut ? `Timeout (${TIMEOUT_MS}ms)` : "Agent did not recall the token";
          capabilityResults.set("5.3", { name: "Semantic search", state: "FAIL", notes: reason });
        }
        logLine(`  [5.3] Semantic search: ${capabilityResults.get("5.3").state} — ${capabilityResults.get("5.3").notes}`);

        const save53 = capabilityResults.get("5.3");
        capabilityResults.set("5.5c", { name: "memory_search tool", state: save53.state, notes: `Implicit in 5.3: ${save53.notes}` });
        logLine(`  [5.5c] memory_search tool: ${save53.state}`);
      }
    }

    // ── Session 4 (Conv-8): 5.4 Memory flush ──────────────────
    logLine("");
    logLine("═══ Session 4: Memory flush (5.4) ═══");
    if (!FLUSH_EVERY || FLUSH_EVERY > 10) {
      const reason = !FLUSH_EVERY
        ? "MEMORY_FLUSH_EVERY not set (default 20 — too many messages for test)"
        : `MEMORY_FLUSH_EVERY=${FLUSH_EVERY} (> 10 — too many messages for test)`;
      logLine(`SKIP — ${reason}`);
      capabilityResults.set("5.4", { name: "Memory flush", state: "N/A", notes: reason });
    } else {
      const session = await createSession(token);
      if (!session.session_id) {
        logLine(`session creation FAILED: ${JSON.stringify(session)}`);
        capabilityResults.set("5.4", { name: "Memory flush", state: "FAIL", notes: "Session creation failed" });
      } else {
        logLine(`session created: ${session.session_id}`);
        logLine(`sending ${FLUSH_EVERY} messages to trigger flush...`);

        const memMtimeBefore = fileMtime(MEMORY_PATH);

        for (let i = 1; i <= FLUSH_EVERY; i++) {
          const msg = `Mensagem de teste ${i}/${FLUSH_EVERY}. Diga apenas "ok ${i}".`;
          logLine(`  msg ${i}/${FLUSH_EVERY}`);
          const r = await sendMessage(token, session.session_id, msg);
          if (r.timedOut) {
            logLine(`    timeout`);
          } else {
            logLine(`    ok (${r.fullText.slice(0, 50)})`);
          }
          dialog.push({ question: msg, answer: r.fullText || null, status: r.timedOut ? "FAIL" : "PASS", reason: r.timedOut ? `Timeout (${TIMEOUT_MS}ms)` : null });
        }

        // Wait for background flush to complete
        logLine("waiting 5s for background flush...");
        await new Promise((r) => setTimeout(r, 5000));

        const memMtimeAfter = fileMtime(MEMORY_PATH);
        const flushed = memMtimeAfter !== null && (memMtimeBefore === null || memMtimeAfter > memMtimeBefore);

        if (flushed) {
          capabilityResults.set("5.4", { name: "Memory flush", state: "PASS", notes: `MEMORY.md modified after ${FLUSH_EVERY} messages` });
        } else {
          capabilityResults.set("5.4", { name: "Memory flush", state: "FAIL", notes: `MEMORY.md not modified after ${FLUSH_EVERY} messages` });
        }
        logLine(`  [5.4] Memory flush: ${capabilityResults.get("5.4").state} — ${capabilityResults.get("5.4").notes}`);
      }
    }
  } finally {
    restoreState();
    logLine("");
    logLine("cleanup done");
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

  let md = `# Test Conversation — Memory\n\n`;
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
// Memory paths used:
//
// 1. context/agents/system.probe/MEMORY.md
//    Token CAPABILITY_TEST_TOKEN_2026 — saved in 5.1, recalled in 5.3
//
// 2. context/agents/system.probe/journal/{today}/MEMORY.md
//    Token JOURNAL_PROBE_ENTRY_X9 — saved in 5.2
//
// Prerequisites:
//
// - 5.3 (semantic search) requires OPENAI_API_KEY for embeddings
// - 5.4 (memory flush) requires MEMORY_FLUSH_EVERY ≤ 10 in .env
// - 5.5 is implicit in 5.1 (memory_save), 5.2 (memory_journal), 5.3 (memory_search)
//
// Cleanup:
//   Test tokens are removed from MEMORY.md after the test.
//   Journal entries created by the test are removed if they didn't exist before.
