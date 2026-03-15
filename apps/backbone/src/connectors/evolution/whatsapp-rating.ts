/**
 * Rating feature is temporarily disabled.
 * Current behavior (asking after every single message) was not well designed.
 * Set to false to re-enable when the feature is revisited and properly designed.
 */
export const RATING_DISABLED_PENDING_REDESIGN = true;

/**
 * WhatsApp Rating State Tracker
 *
 * After each agent response on WhatsApp, the system sends a rating prompt
 * ("Essa resposta foi util? Responda SIM ou NAO"). This module tracks which
 * senders have a pending rating response and handles the SIM/NAO flow.
 *
 * State lifecycle:
 *   normal message → agent responds → send rating question → state = "awaiting_rating"
 *   user replies SIM  → record up rating → clear state
 *   user replies NAO  → record down rating (partial) → state = "awaiting_reason" (optional)
 *   user replies text → if awaiting_reason: record reason + clear; else: route normally
 *
 * State is in-memory; resets on server restart (acceptable for UX).
 */

import { randomUUID } from "node:crypto";
import { db } from "../../db/index.js";
import { readMessages } from "../../conversations/persistence.js";

interface PendingRating {
  sessionId: string;
  agentId: string;
  channelId: string;
  /** The instance name used for this channel (for sending the reply) */
  instanceName: string;
  /** messageIndex of the last assistant message to be rated */
  messageIndex: number;
  step: "awaiting_rating" | "awaiting_reason";
  /** Id of the rating record already inserted (for "awaiting_reason" step) */
  ratingId?: string;
}

// Map from senderId (e.g. "5511999999999") to pending state
const pendingRatings = new Map<string, PendingRating>();

export function setPendingRating(senderId: string, state: PendingRating): void {
  pendingRatings.set(senderId, state);
}

export function getPendingRating(senderId: string): PendingRating | undefined {
  return pendingRatings.get(senderId);
}

export function clearPendingRating(senderId: string): void {
  pendingRatings.delete(senderId);
}

/**
 * Detect the last assistant message index in a session.
 * Returns -1 if none found.
 */
export function lastAssistantMessageIndex(agentId: string, sessionId: string): number {
  const messages = readMessages(agentId, sessionId);
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === "assistant") return i;
  }
  return -1;
}

/**
 * Process a SIM/NAO/reason reply from a WhatsApp sender.
 *
 * Returns:
 *  - "handled"   — the message was consumed as a rating response (do not route to agent)
 *  - "passthrough" — message was not a rating response, route normally
 */
export function handlePossibleRatingReply(
  senderId: string,
  text: string,
): "handled" | "passthrough" {
  const pending = pendingRatings.get(senderId);
  if (!pending) return "passthrough";

  const normalized = text.trim().toUpperCase();

  if (pending.step === "awaiting_rating") {
    if (normalized === "SIM" || normalized === "S") {
      // Record up rating
      insertOrUpdateRating(pending, "up", null, null);
      clearPendingRating(senderId);
      return "handled";
    }

    if (normalized === "NAO" || normalized === "NÃO" || normalized === "N") {
      // Record down rating without reason yet; transition to awaiting_reason
      const id = insertOrUpdateRating(pending, "down", null, null);
      pendingRatings.set(senderId, { ...pending, step: "awaiting_reason", ratingId: id });
      return "handled";
    }

    // Unrecognized — clear and pass through so user message reaches the agent
    clearPendingRating(senderId);
    return "passthrough";
  }

  if (pending.step === "awaiting_reason") {
    // Any text here is treated as the optional reason
    updateRatingReason(pending.ratingId!, text.trim());
    clearPendingRating(senderId);
    return "handled";
  }

  return "passthrough";
}

// ── DB helpers ───────────────────────────────────────────────────────────────

function insertOrUpdateRating(
  pending: PendingRating,
  rating: "up" | "down",
  reason: string | null,
  reasonCat: string | null,
): string {
  const id = `rat_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  db.prepare(`
    INSERT INTO message_ratings
      (id, session_id, message_index, agent_id, channel_type, rating, reason, reason_cat, user_ref)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id, message_index) DO UPDATE SET
      rating      = excluded.rating,
      reason      = excluded.reason,
      reason_cat  = excluded.reason_cat,
      rated_at    = datetime('now')
  `).run(
    id,
    pending.sessionId,
    pending.messageIndex,
    pending.agentId,
    "whatsapp",
    rating,
    reason,
    reasonCat,
    pending.sessionId, // user_ref = sessionId for channel messages
  );

  // Return the actual id (may be the existing one on conflict)
  const saved = db
    .prepare(
      "SELECT id FROM message_ratings WHERE session_id = ? AND message_index = ?",
    )
    .get(pending.sessionId, pending.messageIndex) as { id: string } | undefined;

  return saved?.id ?? id;
}

function updateRatingReason(ratingId: string, reason: string): void {
  db.prepare(
    "UPDATE message_ratings SET reason = ?, rated_at = datetime('now') WHERE id = ?",
  ).run(reason, ratingId);
}
