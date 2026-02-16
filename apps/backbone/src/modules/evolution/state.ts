import type { BackboneEventBus } from "../../events/index.js";
import type { InstanceState } from "./types.js";

/** Shape of each element returned by Evolution API's fetchInstances. */
interface RawInstance {
  instance: {
    instanceName: string;
    instanceId: string;
    owner?: string | null;
    profileName?: string | null;
    status: string;
  };
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

export class EvolutionStateTracker {
  private instances = new Map<string, InstanceState>();

  constructor(
    private eventBus: BackboneEventBus,
    private log: (msg: string) => void,
  ) {}

  /** Called by the probe on each successful fetch with the raw instance list. */
  update(rawInstances: unknown[]): void {
    const now = Date.now();
    const incoming = new Map<string, RawInstance>();

    for (const raw of rawInstances) {
      const r = raw as RawInstance;
      if (r?.instance?.instanceName) {
        incoming.set(r.instance.instanceName, r);
      }
    }

    // Detect removed instances (present in tracking but absent from API)
    for (const [name, tracked] of this.instances) {
      if (!incoming.has(name)) {
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
      const state = this.normalizeState(raw.instance.status);
      const existing = this.instances.get(name);

      if (!existing) {
        // New instance discovered
        const entry: InstanceState = {
          instanceName: name,
          instanceId: raw.instance.instanceId,
          state,
          since: now,
          previousState: null,
          owner: raw.instance.owner ?? null,
          profileName: raw.instance.profileName ?? null,
        };
        this.instances.set(name, entry);
        this.log(`instance discovered: ${name} (${state})`);
        this.eventBus.emitModule("evolution", "instance-discovered", {
          ts: now,
          instanceName: name,
          state,
          previousState: null,
          since: now,
          durationInPreviousState: null,
        } satisfies InstanceEventPayload);
        continue;
      }

      // Update mutable fields if changed
      existing.owner = raw.instance.owner ?? null;
      existing.profileName = raw.instance.profileName ?? null;

      // Check for state transition
      if (existing.state !== state) {
        const durationInPreviousState = now - existing.since;
        const previousState = existing.state;

        this.log(`instance ${name}: ${previousState} → ${state} (was ${previousState} for ${durationInPreviousState}ms)`);

        existing.previousState = previousState;
        existing.state = state;
        existing.since = now;

        const eventName = this.getTransitionEvent(previousState, state);
        if (eventName) {
          this.eventBus.emitModule("evolution", eventName, {
            ts: now,
            instanceName: name,
            state,
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

  private normalizeState(status: string): "open" | "close" | "connecting" {
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
