import type { EvolutionConfig } from "./types.js";

export const defaultEvolutionConfig: EvolutionConfig = {
  probe: { intervalMs: 30_000, timeoutMs: 10_000 },
  thresholds: {
    flapping: { changes: 5, windowMs: 300_000 },
    prolongedOfflineMs: 600_000,
  },
  actions: { maxRetries: 3, cooldownMs: 60_000 },
};
