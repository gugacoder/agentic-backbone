import type { BackboneEventBus } from "../../events/index.js";
import type { EvolutionConfig } from "./types.js";
import type { InstanceWithDuration } from "./state.js";

interface FlappingPayload {
  ts: number;
  instanceName: string;
  changeCount: number;
  windowMs: number;
}

interface ProlongedOfflinePayload {
  ts: number;
  instanceName: string;
  offlineSinceMs: number;
  durationMs: number;
}

export class EvolutionPatternDetector {
  /** Per-instance array of state-change timestamps. */
  private changeHistory = new Map<string, number[]>();

  /** Tracks which instances have had their prolonged-offline event emitted
   *  for the current offline occurrence (keyed by since timestamp). */
  private prolongedEmitted = new Set<string>();

  constructor(
    private eventBus: BackboneEventBus,
    private config: EvolutionConfig,
    private log: (msg: string) => void,
  ) {}

  /**
   * Called whenever a state transition is detected for an instance.
   * Records the change timestamp and checks for flapping.
   */
  recordStateChange(instanceName: string): void {
    const now = Date.now();
    const { changes, windowMs } = this.config.thresholds.flapping;

    let history = this.changeHistory.get(instanceName);
    if (!history) {
      history = [];
      this.changeHistory.set(instanceName, history);
    }

    history.push(now);

    // Prune entries outside the window
    const cutoff = now - windowMs;
    while (history.length > 0 && history[0] < cutoff) {
      history.shift();
    }

    // Check flapping threshold
    if (history.length >= changes) {
      this.log(`flapping detected: ${instanceName} (${history.length} changes in ${windowMs}ms)`);
      this.eventBus.emitModule("evolution", "instance-unstable", {
        ts: now,
        instanceName,
        changeCount: history.length,
        windowMs,
      } satisfies FlappingPayload);
    }
  }

  /**
   * Called on each probe tick with the current list of tracked instances.
   * Checks for prolonged offline (state "close" beyond threshold).
   */
  checkProlongedOffline(instances: InstanceWithDuration[]): void {
    const now = Date.now();
    const threshold = this.config.thresholds.prolongedOfflineMs;

    for (const inst of instances) {
      const dedupeKey = `${inst.instanceName}:${inst.since}`;

      if (inst.state === "close" && inst.durationMs > threshold) {
        if (!this.prolongedEmitted.has(dedupeKey)) {
          this.prolongedEmitted.add(dedupeKey);
          this.log(`prolonged offline: ${inst.instanceName} (since ${inst.since}, ${inst.durationMs}ms)`);
          this.eventBus.emitModule("evolution", "instance-prolonged-offline", {
            ts: now,
            instanceName: inst.instanceName,
            offlineSinceMs: inst.since,
            durationMs: inst.durationMs,
          } satisfies ProlongedOfflinePayload);
        }
      }
    }

    // Clean up emitted keys for instances no longer in "close" state or removed
    const activeCloseKeys = new Set(
      instances
        .filter((i) => i.state === "close")
        .map((i) => `${i.instanceName}:${i.since}`),
    );
    for (const key of this.prolongedEmitted) {
      if (!activeCloseKeys.has(key)) {
        this.prolongedEmitted.delete(key);
      }
    }
  }

  /** Clears all tracking data for a removed instance. */
  clearInstance(instanceName: string): void {
    this.changeHistory.delete(instanceName);
    // Clean up any prolonged-offline entries for this instance
    for (const key of this.prolongedEmitted) {
      if (key.startsWith(`${instanceName}:`)) {
        this.prolongedEmitted.delete(key);
      }
    }
  }
}
