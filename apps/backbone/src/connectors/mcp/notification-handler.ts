/**
 * MCP Notification Handler — Generic
 *
 * When notifications arrive from MCP servers, this handler delivers them
 * as messages to the agent's conversation session. The agent (LLM) decides
 * what to do based on its prompts (CONVERSATION.md).
 *
 * No business logic here — no tool names, no application-specific flows.
 */

import { mcpClientPool } from "./client.js";
import {
  createSession,
  sendMessage,
  listSessions,
} from "../../conversations/index.js";

interface ActiveAgent {
  agentId: string;
  adapterSlug: string;
  sessionId: string;
  unsubscribe: (() => void) | null;
  presenceInterval: ReturnType<typeof setInterval> | null;
  busy: boolean;
}

const activeAgents = new Map<string, ActiveAgent>();

export function activateNotifications(
  agentId: string,
  adapterSlug: string
): void {
  if (activeAgents.has(agentId)) return;

  // Ensure SSE listener is open for this adapter
  mcpClientPool.ensureSseListener(adapterSlug);

  const sessions = listSessions("system", agentId);
  let sessionId: string;
  if (sessions.length > 0) {
    sessionId = sessions[sessions.length - 1].session_id;
  } else {
    const session = createSession("system", agentId);
    sessionId = session.session_id;
  }

  const unsubscribe = mcpClientPool.onNotification(
    (slug, method, params) => {
      if (slug !== adapterSlug) return;
      handleNotification(agentId, sessionId, method, params);
    }
  );

  // Presence heartbeat: refresh TTL every 55s (no LLM, just HTTP)
  const presenceInterval = setInterval(async () => {
    try {
      await mcpClientPool.callTool(adapterSlug, "presence_heartbeat", {}, agentId);
    } catch {
      try {
        await mcpClientPool.callTool(adapterSlug, "presence_online", { limit: 5 }, agentId);
      } catch {
        console.warn(`[mcp-notify] presence refresh failed for ${agentId}`);
      }
    }
  }, 55_000);

  activeAgents.set(agentId, {
    agentId,
    adapterSlug,
    sessionId,
    unsubscribe,
    presenceInterval,
    busy: false,
  });

  console.log(
    `[mcp-notify] activated for ${agentId} (session=${sessionId}, adapter=${adapterSlug})`
  );
}

export function deactivateNotifications(agentId: string): void {
  const entry = activeAgents.get(agentId);
  if (!entry) return;
  if (entry.presenceInterval) clearInterval(entry.presenceInterval);
  if (entry.unsubscribe) entry.unsubscribe();
  activeAgents.delete(agentId);
  console.log(`[mcp-notify] deactivated for ${agentId}`);
}

export function isNotificationActive(agentId: string): boolean {
  return activeAgents.has(agentId);
}

// --- Internal ---

function handleNotification(
  agentId: string,
  sessionId: string,
  method: string,
  params: Record<string, unknown>
): void {
  // Format notification as a human-readable message for the agent
  const message = formatNotificationMessage(method, params);
  if (!message) return;

  dispatchToAgent(agentId, sessionId, message);
}

/**
 * Convert MCP notification into a message the agent can understand.
 * Generic format — no application-specific logic.
 */
function formatNotificationMessage(
  method: string,
  params: Record<string, unknown>
): string | null {
  // Skip heartbeats and internal notifications
  if (method.includes("heartbeat")) return null;

  // Skip self-generated notifications (e.g. comment/created by the agent itself)
  if (params.authorType === "attendant") return null;

  // Skip taken notifications (another attendant took the customer)
  if (method.includes("queue/taken")) return null;

  // Build a descriptive message from the notification
  const paramsStr = Object.entries(params)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(", ");

  return `[MCP NOTIFICATION] ${method} — ${paramsStr}`;
}

async function dispatchToAgent(
  agentId: string,
  sessionId: string,
  message: string
): Promise<void> {
  const entry = activeAgents.get(agentId);
  if (!entry) return;

  if (entry.busy) {
    console.log(`[mcp-notify] ${agentId} busy, queuing for 10s`);
    setTimeout(() => {
      // Only dispatch if not busy anymore — no infinite retry
      const current = activeAgents.get(agentId);
      if (current && !current.busy) {
        dispatchToAgent(agentId, sessionId, message);
      } else {
        console.log(`[mcp-notify] ${agentId} still busy, dropping: ${message.slice(0, 60)}...`);
      }
    }, 10_000);
    return;
  }

  entry.busy = true;
  console.log(`[mcp-notify] dispatching to ${agentId}: ${message.slice(0, 100)}...`);

  try {
    let resultText = "";
    for await (const event of sendMessage("system", sessionId, message)) {
      if (event.type === "result" && event.content) {
        resultText = event.content as string;
      }
    }
    if (resultText) {
      console.log(`[mcp-notify] ${agentId} responded: ${resultText.slice(0, 100)}...`);
    }
  } catch (err) {
    console.error(`[mcp-notify] dispatch failed for ${agentId}:`, err);
  } finally {
    entry.busy = false;
  }
}
