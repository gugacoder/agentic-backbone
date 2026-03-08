import { readdirSync, readFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join, basename } from "node:path";
import { agentDir } from "../context/paths.js";
import { listAgents } from "../agents/registry.js";
import { readYaml, writeYaml, writeFileAtomic } from "../context/readers.js";
import { CronYmlSchema, type CronYml } from "../context/schemas.js";
import type { CronJob, CronJobDef, CronJobState, CronJobPatch, CronSchedule, CronPayload } from "./types.js";

// ── Flat-key ↔ nested conversion ──────────────────────────

function metadataToDef(m: CronYml, slug: string): CronJobDef | null {
  let schedule: CronSchedule;
  switch (m["schedule-kind"]) {
    case "at":
      schedule = { kind: "at", at: m["schedule-at"] ?? "" };
      break;
    case "every":
      schedule = {
        kind: "every",
        everyMs: m["schedule-everyMs"] ?? 0,
        ...(m["schedule-anchorMs"] != null ? { anchorMs: m["schedule-anchorMs"] } : {}),
      };
      break;
    case "cron":
      schedule = {
        kind: "cron",
        expr: m["schedule-expr"] ?? "",
        ...(m["schedule-tz"] ? { tz: m["schedule-tz"] } : {}),
      };
      break;
    default:
      return null;
  }

  const payloadKind = m["payload-kind"];
  let payload: CronPayload;
  if (payloadKind === "conversation" || payloadKind === "request") {
    payload = { kind: payloadKind, message: m["payload-message"] ?? "" };
  } else {
    payload = { kind: "heartbeat" };
  }

  return {
    name: m["name"] ?? slug,
    enabled: m["enabled"],
    schedule,
    payload,
    deleteAfterRun: m["deleteAfterRun"] === true ? true : undefined,
    description: m["description"] || undefined,
  };
}

function defToMetadata(def: CronJobDef): Record<string, unknown> {
  const m: Record<string, unknown> = {};

  m["name"] = def.name;
  m["enabled"] = def.enabled;

  m["schedule-kind"] = def.schedule.kind;
  switch (def.schedule.kind) {
    case "at":
      m["schedule-at"] = def.schedule.at;
      break;
    case "every":
      m["schedule-everyMs"] = def.schedule.everyMs;
      if (def.schedule.anchorMs != null) m["schedule-anchorMs"] = def.schedule.anchorMs;
      break;
    case "cron":
      m["schedule-expr"] = def.schedule.expr;
      if (def.schedule.tz) m["schedule-tz"] = def.schedule.tz;
      break;
  }

  m["payload-kind"] = def.payload.kind;
  if (def.payload.kind !== "heartbeat") {
    m["payload-message"] = def.payload.message;
  }

  if (def.deleteAfterRun != null) m["deleteAfterRun"] = def.deleteAfterRun;
  if (def.description) m["description"] = def.description;

  return m;
}

// ── State persistence (.state.json) ───────────────────────

function stateFilePath(agentId: string): string {
  return join(agentDir(agentId), "cron", ".state.json");
}

export function loadAgentCronState(agentId: string): Record<string, CronJobState> {
  const p = stateFilePath(agentId);
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return {};
  }
}

export function saveAgentCronState(
  agentId: string,
  states: Record<string, CronJobState>
): void {
  const dir = join(agentDir(agentId), "cron");
  mkdirSync(dir, { recursive: true });
  writeFileAtomic(stateFilePath(agentId), JSON.stringify(states, null, 2));
}

// ── Scan ──────────────────────────────────────────────────

function cronDir(agentId: string): string {
  return join(agentDir(agentId), "cron");
}

export function scanAgentCronJobs(agentId: string): CronJob[] {
  const dir = cronDir(agentId);
  if (!existsSync(dir)) return [];

  const jobs: CronJob[] = [];
  const stateMap = loadAgentCronState(agentId);

  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".yml")) continue;
    const slug = basename(entry, ".yml");
    const filePath = join(dir, entry);

    try {
      const raw = readYaml(filePath);
      const result = CronYmlSchema.safeParse(raw);
      if (!result.success) {
        console.warn(`[cron] invalid cron file ${entry} for agent ${agentId}:`, result.error.issues);
        continue;
      }
      const def = metadataToDef(result.data, slug);
      if (!def) continue;

      jobs.push({
        slug,
        agentId,
        path: filePath,
        def,
        state: stateMap[slug] ?? {},
      });
    } catch {
      // skip malformed files
    }
  }

  return jobs;
}

export function scanCronJobs(): CronJob[] {
  const agents = listAgents();
  const jobs: CronJob[] = [];
  for (const agent of agents) {
    jobs.push(...scanAgentCronJobs(agent.id));
  }
  return jobs;
}

// ── CRUD ──────────────────────────────────────────────────

export function createCronJobFile(
  agentId: string,
  slug: string,
  def: CronJobDef
): string {
  const dir = cronDir(agentId);
  mkdirSync(dir, { recursive: true });

  const filePath = join(dir, `${slug}.yml`);
  const metadata = defToMetadata(def);
  writeYaml(filePath, metadata);
  return filePath;
}

export function updateCronJobFile(jobPath: string, patch: CronJobPatch): void {
  const config = readYaml(jobPath);

  if (patch.name !== undefined) config["name"] = patch.name;
  if (patch.enabled !== undefined) config["enabled"] = patch.enabled;
  if (patch.deleteAfterRun !== undefined) config["deleteAfterRun"] = patch.deleteAfterRun;
  if (patch.description !== undefined) config["description"] = patch.description;

  if (patch.schedule) {
    config["schedule-kind"] = patch.schedule.kind;
    switch (patch.schedule.kind) {
      case "at":
        config["schedule-at"] = patch.schedule.at;
        break;
      case "every":
        config["schedule-everyMs"] = patch.schedule.everyMs;
        if (patch.schedule.anchorMs != null) config["schedule-anchorMs"] = patch.schedule.anchorMs;
        break;
      case "cron":
        config["schedule-expr"] = patch.schedule.expr;
        if (patch.schedule.tz) config["schedule-tz"] = patch.schedule.tz;
        break;
    }
  }

  if (patch.payload) {
    config["payload-kind"] = patch.payload.kind;
    if (patch.payload.kind !== "heartbeat") {
      config["payload-message"] = patch.payload.message;
    }
  }

  writeYaml(jobPath, config);
}

export function deleteCronJobFile(jobPath: string): void {
  if (existsSync(jobPath)) {
    unlinkSync(jobPath);
  }
}
