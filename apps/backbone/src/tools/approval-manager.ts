export type ApprovalOutcome = "approved" | "rejected" | "expired";

interface PendingApproval {
  resolve: (outcome: ApprovalOutcome) => void;
}

const pendingApprovals = new Map<number, PendingApproval>();

/**
 * Registers a pending approval and returns a Promise that resolves when
 * the approval is decided (approved/rejected/expired).
 */
export function registerPendingApproval(
  approvalId: number
): Promise<ApprovalOutcome> {
  return new Promise<ApprovalOutcome>((resolve) => {
    pendingApprovals.set(approvalId, { resolve });
  });
}

/**
 * Resolves a pending approval with the given outcome.
 * Returns true if the approval was found and resolved, false otherwise.
 */
export function resolveApproval(
  approvalId: number,
  outcome: ApprovalOutcome
): boolean {
  const pending = pendingApprovals.get(approvalId);
  if (!pending) return false;
  pendingApprovals.delete(approvalId);
  pending.resolve(outcome);
  return true;
}
