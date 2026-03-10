import type { BackboneEventBus } from "../../events/index.js";
import type {
  InstanceState,
  InstanceTransitionalState,
  InstanceOperationalState,
  EvolutionConfig,
} from "./types.js";

/** Shape of each element returned by Evolution API v2 fetchInstances (flat format). */
interface RawInstance {
  id: string;
  name: string;
  connectionStatus: string;
  ownerJid?: string | null;
  profileName?: string | null;
}

export interface InstanceWithDuration extends InstanceState {
  durationMs: number;
}

interface InstanceEventPayload {
  ts: number;
  instanceName: string;
  state: string;
  previousState: string | null;
  since: number;
  durationInPreviousState: number | null;
}

const TRANSITIONAL_STATES = new Set<string>(["deleting", "reconnecting", "restarting"]);

const TRANSITIONAL_EVENT_MAP: Record<InstanceTransitionalState, string> = {
  deleting: "instance-deleting",
  reconnecting: "instance-operation-reconnecting",
  restarting: "instance-operation-restarting",
};

export class EvolutionStateTracker {
  private instances = new Map<string, InstanceState>();
  private transitionalTimeoutMs: number;

  constructor(
    private eventBus: BackboneEventBus,
    private log: (msg: string) => void,
    config: EvolutionConfig,
  ) {
    this.transitionalTimeoutMs = config.transitional.timeoutMs;
  }

  private isTransitional(state: string): state is InstanceTransitionalState {
    return TRANSITIONAL_STATES.has(state);
  }

  /**
   * Marks an instance as being in a transitional state.
   * Returns true if the instance was found and marked, false otherwise.
   */
  markTransitional(name: string, state: InstanceTransitionalState): boolean {
    const existing = this.instances.get(name);
    if (!existing) return false;

    const now = Date.now();
    existing.previousState = existing.state;
    existing.state = state;
    existing.since = now;

    this.log(`instance ${name}: ${existing.previousState} → ${state} (transitional)`);

    this.eventBus.emitModule("evolution", TRANSITIONAL_EVENT_MAP[state], {
      ts: now,
      instanceName: name,
      state,
      previousState: existing.previousState,
      since: now,
      durationInPreviousState: null,
    } satisfies InstanceEventPayload);

    return true;
  }

  /**
   * Reverts a transitional state back to previousState.
   * Used when the Evolution API call fails.
   */
  revertTransitional(name: string): void {
    const existing = this.instances.get(name);
    if (!existing || !this.isTransitional(existing.state)) return;

    const now = Date.now();
    const transitionalState = existing.state;
    const revertTo = (existing.previousState ?? "close") as InstanceOperationalState;

    existing.state = revertTo;
    existing.previousState = transitionalState;
    existing.since = now;

    this.log(`instance ${name}: reverted ${transitionalState} → ${revertTo}`);

    const eventName = this.getTransitionEvent(transitionalState, revertTo);
    if (eventName) {
      this.eventBus.emitModule("evolution", eventName, {
        ts: now,
        instanceName: name,
        state: revertTo,
        previousState: transitionalState,
        since: now,
        durationInPreviousState: null,
      } satisfies InstanceEventPayload);
    }
  }

  /** Called by the probe on each successful fetch with the raw instance list. */
  update(rawInstances: unknown[]): void {
    const now = Date.now();
    const incoming = new Map<string, RawInstance>();

    for (const raw of rawInstances) {
      const r = raw as RawInstance;
      if (r?.name) {
        incoming.set(r.name, r);
      }
    }

    // Detect removed instances (present in tracking but absent from API)
    for (const [name, tracked] of this.instances) {
      if (!incoming.has(name)) {
        // For "deleting" — absence confirms the operation succeeded
        // For other states — instance was removed externally
        this.instances.delete(name);
        this.log(`instance removed: ${name}`);
        this.eventBus.emitModule("evolution", "instance-removed", {
          ts: now,
          instanceName: name,
          state: tracked.state,
          previousState: tracked.previousState,
          since: tracked.since,
          durationInPreviousState: null,
        } satisfies InstanceEventPayload);
      }
    }

    // Process each incoming instance
    for (const [name, raw] of incoming) {
      const probeState = this.normalizeState(raw.connectionStatus);
      const existing = this.instances.get(name);

      if (!existing) {
        // New instance discovered
        const entry: InstanceState = {
          instanceName: name,
          instanceId: raw.id,
          state: probeState,
          since: now,
          previousState: null,
          owner: raw.ownerJid ?? null,
          profileName: raw.profileName ?? null,
        };
        this.instances.set(name, entry);
        this.log(`instance discovered: ${name} (${probeState})`);
        this.eventBus.emitModule("evolution", "instance-discovered", {
          ts: now,
          instanceName: name,
          state: probeState,
          previousState: null,
          since: now,
          durationInPreviousState: null,
        } satisfies InstanceEventPayload);
        continue;
      }

      // Update mutable fields if changed
      existing.owner = raw.ownerJid ?? null;
      existing.profileName = raw.profileName ?? null;

      // --- Transitional state reconciliation ---
      if (this.isTransitional(existing.state)) {
        const elapsed = now - existing.since;

        if (existing.state === "deleting") {
          // Instance still present → keep "deleting" (cleanup not done yet)
          // Check timeout
          if (elapsed > this.transitionalTimeoutMs) {
            this.timeoutTransitional(existing, probeState, now, elapsed);
          }
          continue;
        }

        // "reconnecting" / "restarting"
        if (probeState === "open") {
          // Operation confirmed — transition to "open"
          const durationInPreviousState = elapsed;
          const previousState = existing.state;

          this.log(`instance ${name}: ${previousState} → open (operation confirmed)`);

          existing.previousState = previousState;
          existing.state = "open";
          existing.since = now;

          this.eventBus.emitModule("evolution", "instance-connected", {
            ts: now,
            instanceName: name,
            state: "open",
            previousState,
            since: now,
            durationInPreviousState,
          } satisfies InstanceEventPayload);
          continue;
        }

        // Not yet "open" — check timeout
        if (elapsed > this.transitionalTimeoutMs) {
          this.timeoutTransitional(existing, probeState, now, elapsed);
        }
        continue;
      }

      // --- Normal state transition ---
      if (existing.state !== probeState) {
        const durationInPreviousState = now - existing.since;
        const previousState = existing.state;

        this.log(`instance ${name}: ${previousState} → ${probeState} (was ${previousState} for ${durationInPreviousState}ms)`);

        existing.previousState = previousState;
        existing.state = probeState;
        existing.since = now;

        const eventName = this.getTransitionEvent(previousState, probeState);
        if (eventName) {
          this.eventBus.emitModule("evolution", eventName, {
            ts: now,
            instanceName: name,
            state: probeState,
            previousState,
            since: now,
            durationInPreviousState,
          } satisfies InstanceEventPayload);
        }
      }
    }
  }

  /** Returns all tracked instances with calculated duration. */
  getInstances(): InstanceWithDuration[] {
    const now = Date.now();
    const result: InstanceWithDuration[] = [];

    for (const inst of this.instances.values()) {
      result.push({
        ...inst,
        durationMs: now - inst.since,
      });
    }

    return result;
  }

  /** Returns a single instance by name, or undefined if not found. */
  getInstance(name: string): InstanceWithDuration | undefined {
    const inst = this.instances.get(name);
    if (!inst) return undefined;
    return {
      ...inst,
      durationMs: Date.now() - inst.since,
    };
  }

  /** Called when an instance transitions back to open (for retry counter reset). */
  getState(name: string): InstanceState | undefined {
    return this.instances.get(name);
  }

  private timeoutTransitional(
    instance: InstanceState,
    probeState: InstanceOperationalState,
    now: number,
    elapsed: number,
  ): void {
    const operation = instance.state;

    this.log(`instance ${instance.instanceName}: transitional timeout (${operation}, ${elapsed}ms) → reverting to ${probeState}`);

    instance.previousState = instance.state;
    instance.state = probeState;
    instance.since = now;

    this.eventBus.emitModule("evolution", "instance-operation-timeout", {
      ts: now,
      instanceName: instance.instanceName,
      operation,
      durationMs: elapsed,
    });
  }

  private normalizeState(status: string): InstanceOperationalState {
    if (status === "open") return "open";
    if (status === "connecting") return "connecting";
    return "close";
  }

  private getTransitionEvent(from: string, to: string): string | null {
    // open → close: instance-disconnected
    if (from === "open" && to === "close") return "instance-disconnected";
    // open → connecting: instance-reconnecting
    if (from === "open" && to === "connecting") return "instance-reconnecting";
    // close → open: instance-connected
    if (from === "close" && to === "open") return "instance-connected";
    // connecting → open: instance-connected
    if (from === "connecting" && to === "open") return "instance-connected";
    // connecting → close: instance-disconnected
    if (from === "connecting" && to === "close") return "instance-disconnected";
    // close → connecting: instance-reconnecting
    if (from === "close" && to === "connecting") return "instance-reconnecting";
    return null;
  }
}
