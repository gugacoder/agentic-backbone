// --- Probe ---

export interface ProbeResult {
  timestamp: number;
  status: "online" | "offline";
  responseTimeMs: number | null;
  error: string | null;
}

// --- Instance State ---

export interface InstanceState {
  instanceName: string;
  instanceId: string;
  state: "open" | "close" | "connecting";
  since: number;
  previousState: string | null;
  owner: string | null;
}

// --- Configuration ---

export interface EvolutionConfig {
  probe: {
    intervalMs: number;
    timeoutMs: number;
  };
  thresholds: {
    flapping: {
      changes: number;
      windowMs: number;
    };
    prolongedOfflineMs: number;
  };
  actions: {
    maxRetries: number;
    cooldownMs: number;
  };
}
