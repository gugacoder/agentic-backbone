import type { ActiveHoursConfig } from "../heartbeat/active-hours.js";

export interface HeartbeatConfig {
  enabled: boolean;
  intervalMs: number;
  activeHours?: ActiveHoursConfig;
}

export const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  enabled: false,
  intervalMs: 30_000,
};

export interface AgentConfig {
  id: string;
  owner: string;
  slug: string;
  delivery: string;
  enabled: boolean;
  heartbeat: HeartbeatConfig;
  metadata: Record<string, unknown>;
  description: string;
}
