import { db } from "../db/index.js";
import { eventBus } from "../events/index.js";
import { registerPendingApproval } from "./approval-manager.js";
import type { ToolApprovalConfig } from "./loader.js";


export class ApprovalRejectedError extends Error {
  constructor() {
    super("Ação cancelada: pedido de aprovação rejeitado pelo operador.");
    this.name = "ApprovalRejectedError";
  }
}

export class ApprovalExpiredError extends Error {
  constructor() {
    super("Ação cancelada: tempo de aprovação esgotado.");
    this.name = "ApprovalExpiredError";
  }
}

/**
 * Wraps a tool's execute function with an approval gate.
 * Creates an approval_requests record, emits SSE, then waits for
 * the operator to approve or reject before proceeding.
 */
export function withApprovalGate(
  agentId: string,
  toolName: string,
  config: ToolApprovalConfig,
  sessionId: string | undefined,
  payload: unknown,
  execute: () => Promise<unknown>
): Promise<unknown> {
  const timeoutMs = config.approvalTimeoutSeconds * 1000;
  const expiresAt = new Date(Date.now() + timeoutMs);
  // SQLite datetime format: "YYYY-MM-DD HH:MM:SS"
  const expiresAtSql = expiresAt
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, "");

  const result = db
    .prepare(
      `INSERT INTO approval_requests
         (agent_id, session_id, tool_name, action_label, payload, status, expires_at)
       VALUES (?, ?, ?, ?, ?, 'pending', datetime(?))
       RETURNING id`
    )
    .get(
      agentId,
      sessionId ?? null,
      toolName,
      config.approvalLabel,
      JSON.stringify(payload),
      expiresAtSql
    ) as { id: number };

  const approvalId = result.id;

  eventBus.emit("approval:pending", {
    type: "approval:pending",
    approvalId,
    agentId,
    sessionId: sessionId ?? undefined,
    actionLabel: config.approvalLabel,
    expiresAt: expiresAt.toISOString(),
  });

  const outcomePromise = registerPendingApproval(approvalId);

  return Promise.race([
    outcomePromise,
    new Promise<"expired">((resolve) =>
      setTimeout(() => resolve("expired"), timeoutMs)
    ),
  ]).then((outcome) => {
    if (outcome === "approved") {
      return execute();
    } else if (outcome === "rejected") {
      throw new ApprovalRejectedError();
    } else {
      throw new ApprovalExpiredError();
    }
  });
}
