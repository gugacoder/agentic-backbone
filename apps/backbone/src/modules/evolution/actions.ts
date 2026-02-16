import type { BackboneEventBus } from "../../events/index.js";
import type { EvolutionConfig } from "./types.js";

interface ActionState {
  attempts: number;
  lastAttemptAt: number;
}

interface ActionResult {
  ok: boolean;
  error?: string;
  retryAfterMs?: number;
  attempts?: number;
  maxRetries?: number;
}

/**
 * Manages corrective actions (reconnect / restart) for Evolution instances
 * with cooldown enforcement and retry limits.
 *
 * The module does NOT auto-execute actions — the operator or an agent decides
 * when to act. This class enforces the retry policy and emits events.
 */
export class EvolutionActions {
  /** Per-instance, per-action state: `${instanceName}:${action}` → ActionState */
  private state = new Map<string, ActionState>();

  private baseUrl: string;
  private apiKey: string;

  constructor(
    private eventBus: BackboneEventBus,
    private config: EvolutionConfig,
    private log: (msg: string) => void,
    env: Record<string, string | undefined>,
  ) {
    this.baseUrl = env.EVOLUTION_API_URL!;
    this.apiKey = env.EVOLUTION_API_KEY!;
  }

  /** Execute a reconnect action for the given instance. */
  async reconnect(instanceName: string): Promise<ActionResult> {
    return this.executeAction(instanceName, "reconnect", () =>
      this.callApi("GET", `/instance/connect/${instanceName}`),
    );
  }

  /** Execute a restart action for the given instance. */
  async restart(instanceName: string): Promise<ActionResult> {
    return this.executeAction(instanceName, "restart", () =>
      this.callApi("PUT", `/instance/restart/${instanceName}`),
    );
  }

  /**
   * Resets retry counters for an instance. Called when the instance
   * transitions back to "open" (successful recovery by any means).
   */
  resetCounters(instanceName: string): void {
    const reconnectKey = `${instanceName}:reconnect`;
    const restartKey = `${instanceName}:restart`;

    if (this.state.has(reconnectKey) || this.state.has(restartKey)) {
      this.state.delete(reconnectKey);
      this.state.delete(restartKey);
      this.log(`retry counters reset: ${instanceName}`);
    }
  }

  /** Cleans up all state for a removed instance. */
  removeInstance(instanceName: string): void {
    this.state.delete(`${instanceName}:reconnect`);
    this.state.delete(`${instanceName}:restart`);
  }

  private async executeAction(
    instanceName: string,
    action: "reconnect" | "restart",
    apiCall: () => Promise<boolean>,
  ): Promise<ActionResult> {
    const key = `${instanceName}:${action}`;
    const { maxRetries, cooldownMs } = this.config.actions;
    const now = Date.now();

    let actionState = this.state.get(key);
    if (!actionState) {
      actionState = { attempts: 0, lastAttemptAt: 0 };
      this.state.set(key, actionState);
    }

    // Check retries exhausted
    if (actionState.attempts >= maxRetries) {
      return {
        ok: false,
        error: "retries_exhausted",
        attempts: actionState.attempts,
        maxRetries,
      };
    }

    // Check cooldown
    const elapsed = now - actionState.lastAttemptAt;
    if (actionState.lastAttemptAt > 0 && elapsed < cooldownMs) {
      return {
        ok: false,
        error: "cooldown_active",
        retryAfterMs: cooldownMs - elapsed,
      };
    }

    // Execute the action
    actionState.lastAttemptAt = now;
    actionState.attempts++;

    this.log(`executing ${action} for ${instanceName} (attempt ${actionState.attempts}/${maxRetries})`);

    try {
      const success = await apiCall();

      if (success) {
        this.log(`${action} succeeded: ${instanceName}`);
        this.eventBus.emitModule("evolution", "action-success", {
          ts: now,
          instanceName,
          action,
          attempt: actionState.attempts,
        });
        return { ok: true };
      }

      this.log(`${action} failed: ${instanceName}`);
      this.eventBus.emitModule("evolution", "action-failed", {
        ts: now,
        instanceName,
        action,
        attempt: actionState.attempts,
        error: "api_error",
      });

      if (actionState.attempts >= maxRetries) {
        this.log(`${action} exhausted: ${instanceName} (${maxRetries} retries)`);
        this.eventBus.emitModule("evolution", "action-exhausted", {
          ts: now,
          instanceName,
          action,
          attempts: actionState.attempts,
          maxRetries,
        });
      }

      return { ok: false, error: "action_failed" };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.log(`${action} error: ${instanceName} — ${errorMsg}`);

      this.eventBus.emitModule("evolution", "action-failed", {
        ts: now,
        instanceName,
        action,
        attempt: actionState.attempts,
        error: errorMsg,
      });

      if (actionState.attempts >= maxRetries) {
        this.log(`${action} exhausted: ${instanceName} (${maxRetries} retries)`);
        this.eventBus.emitModule("evolution", "action-exhausted", {
          ts: now,
          instanceName,
          action,
          attempts: actionState.attempts,
          maxRetries,
        });
      }

      return { ok: false, error: errorMsg };
    }
  }

  private async callApi(method: string, path: string): Promise<boolean> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: { apikey: this.apiKey },
    });
    return response.ok;
  }
}
