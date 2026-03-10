import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join, basename } from "node:path";
import yaml from "js-yaml";
import { agentDir } from "../context/paths.js";
import { listAgents } from "../agents/registry.js";
import { writeFileAtomic } from "../context/frontmatter-writer.js";
import { extractFrontmatterYaml } from "../context/metadata-loader.js";
import type { CronJob, CronJobDef, CronJobState, CronJobPatch, CronSchedule, CronPayload } from "./types.js";

// ── Nested metadata ↔ CronJobDef conversion ──────────────

function metadataToDef(m: Record<string, unknown>, slug: string): CronJobDef | null {
  const schedule = m["schedule"] as { kind?: string; expr?: string; tz?: string; at?: string; everyMs?: number; anchorMs?: number } | undefined;
  if (!schedule?.kind) return null;

  let sched: CronSchedule;
  switch (schedule.kind) {
    case "at":    sched = { kind: "at", at: schedule.at as string }; break;
    case "every": sched = { kind: "every", everyMs: Number(schedule.everyMs), ...(schedule.anchorMs != null ? { anchorMs: Number(schedule.anchorMs) } : {}) }; break;
    case "cron":  sched = { kind: "cron", expr: schedule.expr as string, ...(schedule.tz ? { tz: schedule.tz } : {}) }; break;
    default:      return null;
  }

  const payloadRaw = m["payload"] as { kind?: string; message?: string; service?: string; input?: Record<string, unknown> } | undefined;
  const payloadKind = payloadRaw?.kind ?? "heartbeat";

  let payload: CronPayload;
  if (payloadKind === "agentTurn") {
    payload = { kind: "agentTurn", message: payloadRaw?.message ?? "" };
  } else if (payloadKind === "service") {
    payload = { kind: "service", service: payloadRaw?.service ?? "", input: payloadRaw?.input ?? {} };
  } else if (payloadKind === "request") {
    payload = { kind: "request", service: payloadRaw?.service, input: payloadRaw?.input };
  } else {
    payload = { kind: "heartbeat" };
  }

  return {
    name: (m["name"] as string) ?? slug,
    enabled: m["enabled"] !== false,
    schedule: sched,
    payload,
    deleteAfterRun: m["deleteAfterRun"] === true ? true : undefined,
    description: m["description"] as string | undefined,
  };
}

function defToMetadata(def: CronJobDef): Record<string, unknown> {
  return {
    name: def.name,
    enabled: def.enabled,
    schedule: def.schedule,
    payload: def.payload,
    ...(def.deleteAfterRun != null ? { deleteAfterRun: def.deleteAfterRun } : {}),
    ...(def.description ? { description: def.description } : {}),
  };
}

function serializeYamlFrontmatter(metadata: Record<string, unknown>, content: string): string {
  const yamlBlock = yaml.dump(metadata, { lineWidth: -1, quotingType: '"', forceQuotes: false }).trimEnd();
  return `---\n${yamlBlock}\n---\n${content}`;
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
    const isMd = entry.endsWith(".md");
    const isYaml = entry.endsWith(".yaml");
    if (!isMd && !isYaml) continue;
    if (entry.startsWith(".")) continue;
    const slug = basename(entry, isMd ? ".md" : ".yaml");
    const filePath = join(dir, entry);

    try {
      const raw = readFileSync(filePath, "utf-8");
      let metadata: Record<string, unknown> | null;
      if (isYaml) {
        const parsed = yaml.load(raw);
        metadata = (parsed && typeof parsed === "object") ? parsed as Record<string, unknown> : null;
      } else {
        metadata = extractFrontmatterYaml(raw).data;
      }
      if (!metadata) continue;
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

  const filePath = join(dir, `${slug}.yaml`);
  const metadata = defToMetadata(def);
  writeFileAtomic(filePath, yaml.dump(metadata, { lineWidth: -1, quotingType: '"', forceQuotes: false }));
  return filePath;
}

export function updateCronJobFile(jobPath: string, patch: CronJobPatch): void {
  const raw = readFileSync(jobPath, "utf-8");
  const isYamlFile = jobPath.endsWith(".yaml");

  let current: Record<string, unknown>;
  let content = "";
  if (isYamlFile) {
    const parsed = yaml.load(raw);
    current = (parsed && typeof parsed === "object") ? parsed as Record<string, unknown> : {};
  } else {
    const result = extractFrontmatterYaml(raw);
    current = result.data ?? {};
    content = result.content;
  }

  if (patch.name !== undefined) current["name"] = patch.name;
  if (patch.enabled !== undefined) current["enabled"] = patch.enabled;
  if (patch.deleteAfterRun !== undefined) current["deleteAfterRun"] = patch.deleteAfterRun;
  if (patch.description !== undefined) current["description"] = patch.description;
  if (patch.schedule) current["schedule"] = patch.schedule;
  if (patch.payload) current["payload"] = patch.payload;

  if (isYamlFile) {
    writeFileAtomic(jobPath, yaml.dump(current, { lineWidth: -1, quotingType: '"', forceQuotes: false }));
  } else {
    writeFileAtomic(jobPath, serializeYamlFrontmatter(current, content));
  }
}

export function deleteCronJobFile(jobPath: string): void {
  if (existsSync(jobPath)) {
    unlinkSync(jobPath);
  }
}
