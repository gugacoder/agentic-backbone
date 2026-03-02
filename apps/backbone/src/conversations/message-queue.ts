/**
 * In-memory message queue per session.
 *
 * When an agent is already processing a session and the user sends another
 * message, it gets enqueued here instead of starting a concurrent invocation.
 * The agent can drain queued messages via the `check_messages` tool.
 */

const queues = new Map<string, string[]>();
const processing = new Set<string>();
const sentViaToolInSession = new Set<string>();

export function isProcessing(sessionId: string): boolean {
  return processing.has(sessionId);
}

export function markProcessing(sessionId: string): void {
  processing.add(sessionId);
}

export function markIdle(sessionId: string): void {
  processing.delete(sessionId);
}

export function enqueue(sessionId: string, message: string): void {
  const q = queues.get(sessionId) ?? [];
  q.push(message);
  queues.set(sessionId, q);
}

export function drain(sessionId: string): string[] {
  const q = queues.get(sessionId) ?? [];
  queues.delete(sessionId);
  return q;
}

// --- send_message tracking ---
// Tracks whether the agent used send_message during a session invocation.
// Set by the send_message tool, read by inbound-router to avoid duplicating
// the final response.

export function markSentViaTool(sessionId: string): void {
  sentViaToolInSession.add(sessionId);
}

export function didSendViaTool(sessionId: string): boolean {
  return sentViaToolInSession.has(sessionId);
}

export function clearSendTracking(sessionId: string): void {
  sentViaToolInSession.delete(sessionId);
}
