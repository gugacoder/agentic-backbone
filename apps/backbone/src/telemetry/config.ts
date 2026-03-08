import { db } from "../db/index.js";
import { DEFAULT_OTEL_CONFIG, OTelConfigSchema, type OTelConfig } from "./schemas.js";

const SETTINGS_KEY = "otel";

export function getOTelConfig(): OTelConfig {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(SETTINGS_KEY) as { value: string } | undefined;

  if (!row) return DEFAULT_OTEL_CONFIG;

  try {
    const parsed = JSON.parse(row.value);
    return OTelConfigSchema.parse(parsed);
  } catch {
    return DEFAULT_OTEL_CONFIG;
  }
}

export function setOTelConfig(config: OTelConfig): void {
  const validated = OTelConfigSchema.parse(config);
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(SETTINGS_KEY, JSON.stringify(validated));
}
