#!/usr/bin/env node
/**
 * Test — Conversations (full CRUD + messaging)
 *
 * Tests all conversation endpoints:
 *   1. Login
 *   2. POST   /conversations           — create session
 *   3. GET    /conversations/:id        — get session
 *   4. GET    /conversations            — list sessions
 *   5. PATCH  /conversations/:id        — update title
 *   6. POST   /conversations/:id/messages — send message (SSE)
 *   7. GET    /conversations/:id/messages — read messages
 *   8. GET    /conversations/:id/export   — export JSON
 *   9. GET    /conversations/:id/export?format=markdown — export markdown
 *  10. DELETE /conversations/:id        — delete session
 *  11. Edge cases (404, 400)
 *
 * Usage:
 *   node tests/test-conversations.mjs
 */

// ── Config ──────────────────────────────────────────────────

const BASE = `http://localhost:${process.env.BACKBONE_PORT || 8004}`;
const SYSUSER = process.env.SYSUSER || "admin";
const SYSPASS = process.env.SYSPASS || "changeme";
const AGENT_ID = "system.probe";
const SEND_TIMEOUT_MS = 120_000;

let passed = 0;
let failed = 0;
const results = [];

function ok(name, details) {
  passed++;
  results.push({ name, status: "PASS", details });
  console.log(`  ✓ ${name}`);
}

function fail(name, details) {
  failed++;
  results.push({ name, status: "FAIL", details });
  console.error(`  ✗ ${name} — ${details}`);
}

function assert(cond, name, details) {
  if (cond) ok(name);
  else fail(name, details || "assertion failed");
}

// ── Helpers ─────────────────────────────────────────────────

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: SYSUSER, password: SYSPASS }),
  });
  const data = await res.json();
  return { res, data };
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function sendMessageSSE(token, sessionId, message, timeoutMs = SEND_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let fullText = "";
  let events = [];
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
          events.push(event);
          if (event.type === "text" && event.content) fullText += event.content;
          if (event.type === "result" && event.content) fullText = event.content;
        } catch {}
      }
    }
  } catch (err) {
    if (err.name === "AbortError") timedOut = true;
    else throw err;
  } finally {
    clearTimeout(timer);
  }

  return { fullText, events, timedOut };
}

// ── Tests ───────────────────────────────────────────────────

async function run() {
  console.log(`\nConversation Tests — ${BASE}\n`);

  // ── Preflight ──────────────────────────────────────────
  console.log("Preflight...");
  try {
    const health = await fetch(`${BASE}/health`).then((r) => r.json());
    assert(health.status === "ok", "backbone is reachable");
    const agents = (health.agents ?? []).map((a) => a.id);
    assert(agents.includes(AGENT_ID), `agent ${AGENT_ID} is registered`, `available: [${agents.join(", ")}]`);
  } catch (err) {
    fail("backbone is reachable", err.message);
    return summary();
  }

  // ── 1. Login ───────────────────────────────────────────
  console.log("\n1. Login");
  let token;
  {
    const { res, data } = await login();
    assert(res.status === 200, "login returns 200");
    assert(!!data.token, "login returns JWT token", `got: ${JSON.stringify(data)}`);
    token = data.token;
  }
  if (!token) return summary();

  // ── 2. Create Session ─────────────────────────────────
  console.log("\n2. Create Session");
  let sessionId;
  {
    const res = await fetch(`${BASE}/conversations`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ agentId: AGENT_ID }),
    });
    const data = await res.json();
    assert(res.status === 201, "create returns 201");
    assert(!!data.session_id, "response has session_id", `got: ${JSON.stringify(data)}`);
    assert(data.agent_id === AGENT_ID, `agent_id is ${AGENT_ID}`, `got: ${data.agent_id}`);
    assert(data.user_id === SYSUSER, `user_id is ${SYSUSER}`, `got: ${data.user_id}`);
    assert(data.title === null, "title is null initially");
    sessionId = data.session_id;
  }
  if (!sessionId) return summary();

  // ── 2b. Create Session with invalid agent ─────────────
  console.log("\n2b. Create Session (invalid agent)");
  {
    const res = await fetch(`${BASE}/conversations`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ agentId: "nonexistent.agent" }),
    });
    assert(res.status === 404, "invalid agent returns 404", `got: ${res.status}`);
  }

  // ── 2c. Create Session with default agent ─────────────
  console.log("\n2c. Create Session (default agent)");
  let defaultSessionId;
  {
    const res = await fetch(`${BASE}/conversations`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({}),
    });
    const data = await res.json();
    assert(res.status === 201, "create with default agent returns 201");
    assert(data.agent_id === "system.main", "default agent is system.main", `got: ${data.agent_id}`);
    defaultSessionId = data.session_id;
  }

  // ── 3. Get Session ─────────────────────────────────────
  console.log("\n3. Get Session");
  {
    const res = await fetch(`${BASE}/conversations/${sessionId}`, {
      headers: authHeaders(token),
    });
    const data = await res.json();
    assert(res.status === 200, "get returns 200");
    assert(data.session_id === sessionId, "session_id matches");
    assert(data.agent_id === AGENT_ID, "agent_id matches");
    assert(data.user_id === SYSUSER, "user_id matches");
  }

  // ── 3b. Get non-existent session ───────────────────────
  console.log("\n3b. Get Session (not found)");
  {
    const res = await fetch(`${BASE}/conversations/00000000-0000-0000-0000-000000000000`, {
      headers: authHeaders(token),
    });
    assert(res.status === 404, "non-existent session returns 404", `got: ${res.status}`);
  }

  // ── 4. List Sessions ───────────────────────────────────
  console.log("\n4. List Sessions");
  {
    const res = await fetch(`${BASE}/conversations`, {
      headers: authHeaders(token),
    });
    const data = await res.json();
    assert(res.status === 200, "list returns 200");
    assert(Array.isArray(data), "response is array");
    const ids = data.map((s) => s.session_id);
    assert(ids.includes(sessionId), "newly created session appears in list");
  }

  // ── 4b. List Sessions filtered by agentId ──────────────
  console.log("\n4b. List Sessions (filtered by agentId)");
  {
    const res = await fetch(`${BASE}/conversations?agentId=${AGENT_ID}`, {
      headers: authHeaders(token),
    });
    const data = await res.json();
    assert(res.status === 200, "filtered list returns 200");
    const allMatch = data.every((s) => s.agent_id === AGENT_ID);
    assert(allMatch, `all sessions have agent_id=${AGENT_ID}`, `found: ${data.map((s) => s.agent_id).join(", ")}`);
  }

  // ── 5. Update Session ──────────────────────────────────
  console.log("\n5. Update Session (title)");
  {
    const title = "Test Conversation Title";
    const res = await fetch(`${BASE}/conversations/${sessionId}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({ title }),
    });
    const data = await res.json();
    assert(res.status === 200, "update returns 200");
    assert(data.title === title, "title was updated", `got: ${data.title}`);
  }

  // ── 5b. Update non-existent session ────────────────────
  console.log("\n5b. Update Session (not found)");
  {
    const res = await fetch(`${BASE}/conversations/00000000-0000-0000-0000-000000000000`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({ title: "nope" }),
    });
    assert(res.status === 404, "update non-existent returns 404", `got: ${res.status}`);
  }

  // ── 6. Send Message (SSE) ──────────────────────────────
  console.log("\n6. Send Message (SSE streaming)");
  {
    const { fullText, events, timedOut } = await sendMessageSSE(
      token,
      sessionId,
      "Responda apenas com a frase exata: PONG_TEST_OK"
    );

    assert(!timedOut, "message did not timeout");
    assert(events.length > 0, "received SSE events", `got ${events.length} events`);

    const types = events.map((e) => e.type);
    assert(types.includes("text") || types.includes("result"), "received text/result events", `types: ${types.join(", ")}`);

    const hasUsage = types.includes("usage");
    assert(hasUsage, "received usage event");

    if (hasUsage) {
      const usage = events.find((e) => e.type === "usage");
      assert(usage.usage && typeof usage.usage.inputTokens === "number", "usage has inputTokens");
      assert(usage.usage && typeof usage.usage.outputTokens === "number", "usage has outputTokens");
    }

    assert(fullText.length > 0, "agent produced non-empty response", `length: ${fullText.length}`);
    console.log(`    Agent response (${fullText.length} chars): ${fullText.slice(0, 120)}...`);
  }

  // ── 6b. Send Message without body ──────────────────────
  console.log("\n6b. Send Message (missing message field)");
  {
    const res = await fetch(`${BASE}/conversations/${sessionId}/messages`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({}),
    });
    assert(res.status === 400, "missing message returns 400", `got: ${res.status}`);
  }

  // ── 6c. Send Message to non-existent session ───────────
  console.log("\n6c. Send Message (session not found)");
  {
    const res = await fetch(`${BASE}/conversations/00000000-0000-0000-0000-000000000000/messages`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ message: "hello" }),
    });
    assert(res.status === 404, "message to non-existent session returns 404", `got: ${res.status}`);
  }

  // ── 7. Read Messages ───────────────────────────────────
  console.log("\n7. Read Messages");
  {
    const res = await fetch(`${BASE}/conversations/${sessionId}/messages`, {
      headers: authHeaders(token),
    });
    const data = await res.json();
    assert(res.status === 200, "read messages returns 200");
    assert(Array.isArray(data), "response is array");
    assert(data.length >= 2, "at least 2 messages (user + assistant)", `got: ${data.length}`);

    if (data.length >= 2) {
      const userMsg = data.find((m) => m.role === "user");
      const asstMsg = data.find((m) => m.role === "assistant");
      assert(!!userMsg, "contains user message");
      assert(!!asstMsg, "contains assistant message");
      assert(!!userMsg?.ts, "user message has timestamp");
      assert(!!asstMsg?.ts, "assistant message has timestamp");
      assert(userMsg?.content?.includes("PONG_TEST_OK"), "user message content matches");
    }
  }

  // ── 7b. Read Messages from non-existent session ────────
  console.log("\n7b. Read Messages (not found)");
  {
    const res = await fetch(`${BASE}/conversations/00000000-0000-0000-0000-000000000000/messages`, {
      headers: authHeaders(token),
    });
    assert(res.status === 404, "messages from non-existent session returns 404", `got: ${res.status}`);
  }

  // ── 8. Export (JSON) ───────────────────────────────────
  console.log("\n8. Export Conversation (JSON)");
  {
    const res = await fetch(`${BASE}/conversations/${sessionId}/export`, {
      headers: authHeaders(token),
    });
    const data = await res.json();
    assert(res.status === 200, "export JSON returns 200");
    assert(!!data.session, "export has session object");
    assert(Array.isArray(data.messages), "export has messages array");
    assert(data.session.session_id === sessionId, "export session_id matches");
    assert(data.messages.length >= 2, "export has messages", `got: ${data.messages.length}`);
  }

  // ── 9. Export (Markdown) ───────────────────────────────
  console.log("\n9. Export Conversation (Markdown)");
  {
    const res = await fetch(`${BASE}/conversations/${sessionId}/export?format=markdown`, {
      headers: authHeaders(token),
    });
    assert(res.status === 200, "export markdown returns 200");
    const ct = res.headers.get("content-type");
    assert(ct?.includes("text/markdown"), "content-type is text/markdown", `got: ${ct}`);
    const cd = res.headers.get("content-disposition");
    assert(cd?.includes("attachment"), "has content-disposition attachment", `got: ${cd}`);
    const body = await res.text();
    assert(body.includes("# Conversation"), "markdown starts with header");
    assert(body.includes("**user**"), "markdown contains user messages");
    assert(body.includes("**assistant**"), "markdown contains assistant messages");
  }

  // ── 9b. Export non-existent session ────────────────────
  console.log("\n9b. Export (not found)");
  {
    const res = await fetch(`${BASE}/conversations/00000000-0000-0000-0000-000000000000/export`, {
      headers: authHeaders(token),
    });
    assert(res.status === 404, "export non-existent returns 404", `got: ${res.status}`);
  }

  // ── 10. Delete Session ─────────────────────────────────
  console.log("\n10. Delete Session");
  {
    const res = await fetch(`${BASE}/conversations/${sessionId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    const data = await res.json();
    assert(res.status === 200, "delete returns 200");
    assert(data.status === "deleted", "response is {status:'deleted'}");

    // Verify it's gone
    const getRes = await fetch(`${BASE}/conversations/${sessionId}`, {
      headers: authHeaders(token),
    });
    assert(getRes.status === 404, "session gone after delete", `got: ${getRes.status}`);
  }

  // ── 10b. Delete non-existent session ───────────────────
  console.log("\n10b. Delete Session (not found)");
  {
    const res = await fetch(`${BASE}/conversations/00000000-0000-0000-0000-000000000000`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    assert(res.status === 404, "delete non-existent returns 404", `got: ${res.status}`);
  }

  // ── Cleanup: delete the default session too ────────────
  if (defaultSessionId) {
    await fetch(`${BASE}/conversations/${defaultSessionId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
  }

  summary();
}

function summary() {
  console.log(`\n${"═".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`${"═".repeat(50)}\n`);

  if (failed > 0) {
    console.log("Failed tests:");
    for (const r of results.filter((r) => r.status === "FAIL")) {
      console.log(`  ✗ ${r.name}: ${r.details}`);
    }
    console.log();
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
