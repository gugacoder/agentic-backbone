import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join, basename } from "node:path";
import { agentDir } from "../context/paths.js";
import { listAgents } from "../agents/registry.js";
import { parseFrontmatter, serializeFrontmatter } from "../context/frontmatter.js";
import { writeFileAtomic, updateFrontmatter } from "../context/frontmatter-writer.js";
import type { CronJob, CronJobDef, CronJobState, CronJobPatch, CronSchedule, CronPayload } from "./types.js";

// ── Flat-key ↔ nested conversion ──────────────────────────

function metadataToDef(m: Record<string, unknown>, slug: string): CronJobDef | null {
  const scheduleKind = m["schedule-kind"] as string | undefined;
  if (!scheduleKind) return null;

  let schedule: CronSchedule;
  switch (scheduleKind) {
    case "at":
      schedule = { kind: "at", at: m["schedule-at"] as string };
      break;
    case "every":
      schedule = {
        kind: "every",
        everyMs: Number(m["schedule-everyMs"]),
        ...(m["schedule-anchorMs"] != null ? { anchorMs: Number(m["schedule-anchorMs"]) } : {}),
      };
      break;
    case "cron":
      schedule = {
        kind: "cron",
        expr: m["schedule-expr"] as string,
        ...(m["schedule-tz"] ? { tz: m["schedule-tz"] as string } : {}),
      };
      break;
    default:
      return null;
  }

  const payloadKind = (m["payload-kind"] as string) ?? "heartbeat";
  let payload: CronPayload;
  if (payloadKind === "agentTurn") {
    payload = { kind: "agentTurn", message: (m["payload-message"] as string) ?? "" };
  } else {
    payload = { kind: "heartbeat" };
  }

  return {
    name: (m["name"] as string) ?? slug,
    enabled: m["enabled"] !== false,
    schedule,
    payload,
    deleteAfterRun: m["deleteAfterRun"] === true ? true : undefined,
    description: m["description"] as string | undefined,
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
  if (def.payload.kind === "agentTurn") {
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
    if (!entry.endsWith(".md")) continue;
    const slug = basename(entry, ".md");
    const filePath = join(dir, entry);

    try {
      const raw = readFileSync(filePath, "utf-8");
      const { metadata, content } = parseFrontmatter(raw);
      const def = metadataToDef(metadata, slug);
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

  const filePath = join(dir, `${slug}.md`);
  const metadata = defToMetadata(def);
  const content = def.description ? `# ${def.name}\n\n${def.description}\n` : "";
  const serialized = serializeFrontmatter(metadata, content);
  writeFileAtomic(filePath, serialized);
  return filePath;
}

export function updateCronJobFile(jobPath: string, patch: CronJobPatch): void {
  const updates: Record<string, unknown> = {};

  if (patch.name !== undefined) updates["name"] = patch.name;
  if (patch.enabled !== undefined) updates["enabled"] = patch.enabled;
  if (patch.deleteAfterRun !== undefined) updates["deleteAfterRun"] = patch.deleteAfterRun;
  if (patch.description !== undefined) updates["description"] = patch.description;

  if (patch.schedule) {
    updates["schedule-kind"] = patch.schedule.kind;
    switch (patch.schedule.kind) {
      case "at":
        updates["schedule-at"] = patch.schedule.at;
        break;
      case "every":
        updates["schedule-everyMs"] = patch.schedule.everyMs;
        if (patch.schedule.anchorMs != null) updates["schedule-anchorMs"] = patch.schedule.anchorMs;
        break;
      case "cron":
        updates["schedule-expr"] = patch.schedule.expr;
        if (patch.schedule.tz) updates["schedule-tz"] = patch.schedule.tz;
        break;
    }
  }

  if (patch.payload) {
    updates["payload-kind"] = patch.payload.kind;
    if (patch.payload.kind === "agentTurn") {
      updates["payload-message"] = patch.payload.message;
    }
  }

  updateFrontmatter(jobPath, updates);
}

export function deleteCronJobFile(jobPath: string): void {
  if (existsSync(jobPath)) {
    unlinkSync(jobPath);
  }
}
