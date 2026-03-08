import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { systemDir } from "../context/paths.js";
import { readYaml, writeYaml } from "../context/readers.js";

// --- Routing Types ---

export interface RoutingContext {
  mode: "heartbeat" | "conversation" | "cron" | "webhook";
  estimatedPromptTokens?: number;
  toolsCount?: number;
  channelType?: string;
  tags?: string[];
}

export interface RoutingRule {
  id: string;
  description?: string;
  conditions: {
    mode?: string;
    prompt_tokens_lte?: number;
    prompt_tokens_gte?: number;
    tools_count_gte?: number;
    tools_count_lte?: number;
    tags_any?: string[];
    channel_type?: string;
  };
  model: string;
  priority: number;
}

export interface ModelResult {
  model: string;
  ruleName: string | null;
}

// --- Types ---

export type SlugClass = "small" | "medium" | "large";
export type SlugEffort = "low" | "mid" | "high";
export type SlugName = `${SlugClass}.${SlugEffort}`;

export interface SlugDef {
  slug: SlugName;
  class: SlugClass;
  effort: SlugEffort;
  llm: { model: string; parameters: Record<string, unknown> };
  tags: string[];
  title: string;
  description: string;
}

export interface Plan {
  name: string;
  title: string;
  description: string;
  slugs: Record<SlugName, SlugDef>;
  roles: Record<string, SlugName>;
}

// --- All valid slug names ---

const SLUG_CLASSES: SlugClass[] = ["small", "medium", "large"];
const SLUG_EFFORTS: SlugEffort[] = ["low", "mid", "high"];
const ALL_SLUGS: SlugName[] = SLUG_CLASSES.flatMap((c) =>
  SLUG_EFFORTS.map((e) => `${c}.${e}` as SlugName)
);

// --- Cache ---

let plans: Map<string, Plan> = new Map();
let activePlanName = "";

// --- Paths ---

function plansDir(): string {
  return join(systemDir(), "plans");
}

function settingsPath(): string {
  return join(systemDir(), "settings.yml");
}

// --- Load / Reload ---

export function loadPlans(): void {
  const dir = plansDir();
  if (!existsSync(dir)) {
    throw new Error(`[llm] plans directory not found: ${dir}`);
  }

  const newPlans = new Map<string, Plan>();

  const files = readdirSync(dir).filter((f) => f.endsWith(".yml"));
  for (const file of files) {
    const raw = readYaml(join(dir, file)) as Record<string, unknown>;
    const plan = parsePlan(raw, file);
    newPlans.set(plan.name, plan);
  }

  if (newPlans.size === 0) {
    throw new Error(`[llm] no plans found in ${dir}`);
  }

  // Read active plan from settings.yml
  let active = "";
  if (existsSync(settingsPath())) {
    const settings = readYaml(settingsPath()) as Record<string, unknown>;
    active = (settings["active-plan"] as string) || "";
  }

  if (!active || !newPlans.has(active)) {
    // Fallback to first available plan
    active = newPlans.keys().next().value!;
    console.warn(`[llm] active plan not found, falling back to "${active}"`);
  }

  plans = newPlans;
  activePlanName = active;

  const planNames = [...plans.keys()].join(", ");
  console.log(`[llm] loaded ${plans.size} plans: ${planNames} (active: ${activePlanName})`);
}

export function reloadPlans(): void {
  loadPlans();
}

// --- Accessors ---

export function getActivePlan(): Plan {
  const plan = plans.get(activePlanName);
  if (!plan) {
    throw new Error(`[llm] active plan "${activePlanName}" not found`);
  }
  return plan;
}

export function listPlans(): Plan[] {
  return [...plans.values()];
}

export function setActivePlan(name: string): void {
  if (!plans.has(name)) {
    throw new Error(`[llm] plan "${name}" not found. Available: ${[...plans.keys()].join(", ")}`);
  }

  activePlanName = name;

  // Persist to settings.yml
  const settings = existsSync(settingsPath())
    ? (readYaml(settingsPath()) as Record<string, unknown>)
    : {};
  settings["active-plan"] = name;
  writeYaml(settingsPath(), settings);
}

// --- Resolvers ---

const DEFAULT_SLUG: SlugName = "medium.low";

export function resolveSlug(role: string): SlugDef {
  const plan = getActivePlan();
  const slugName = plan.roles[role] ?? DEFAULT_SLUG;
  const slug = plan.slugs[slugName];
  if (!slug) {
    // Fallback to default slug
    const fallback = plan.slugs[DEFAULT_SLUG];
    if (!fallback) {
      throw new Error(`[llm] no slug "${slugName}" and no fallback "${DEFAULT_SLUG}" in plan "${plan.name}"`);
    }
    return fallback;
  }
  return slug;
}

// --- Routing ---

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function matchesRule(rule: RoutingRule, ctx: RoutingContext): boolean {
  const c = rule.conditions;
  if (c.mode !== undefined && c.mode !== ctx.mode) return false;
  if (c.prompt_tokens_lte !== undefined && (ctx.estimatedPromptTokens ?? 0) > c.prompt_tokens_lte) return false;
  if (c.prompt_tokens_gte !== undefined && (ctx.estimatedPromptTokens ?? 0) < c.prompt_tokens_gte) return false;
  if (c.tools_count_gte !== undefined && (ctx.toolsCount ?? 0) < c.tools_count_gte) return false;
  if (c.tools_count_lte !== undefined && (ctx.toolsCount ?? 0) > c.tools_count_lte) return false;
  if (c.channel_type !== undefined && c.channel_type !== ctx.channelType) return false;
  if (c.tags_any !== undefined && !c.tags_any.some((t) => ctx.tags?.includes(t))) return false;
  return true;
}

function loadGlobalRoutingRules(): RoutingRule[] {
  if (!existsSync(settingsPath())) return [];
  const settings = readYaml(settingsPath()) as Record<string, unknown>;
  const routing = settings["routing"] as { enabled?: boolean; rules?: RoutingRule[] } | undefined;
  if (!routing?.enabled || !routing.rules) return [];
  return routing.rules;
}

export interface RoutingConfig {
  enabled: boolean;
  rules: RoutingRule[];
}

export function getRoutingConfig(): RoutingConfig {
  if (!existsSync(settingsPath())) return { enabled: false, rules: [] };
  const settings = readYaml(settingsPath()) as Record<string, unknown>;
  const routing = settings["routing"] as { enabled?: boolean; rules?: RoutingRule[] } | undefined;
  return {
    enabled: routing?.enabled ?? false,
    rules: routing?.rules ?? [],
  };
}

export function setRoutingConfig(config: RoutingConfig): void {
  const settings = existsSync(settingsPath())
    ? (readYaml(settingsPath()) as Record<string, unknown>)
    : {};
  settings["routing"] = config;
  writeYaml(settingsPath(), settings);
}

export function resolveModelResult(
  role: string,
  context?: RoutingContext,
  agentRoutingRules?: RoutingRule[]
): ModelResult {
  const fallbackModel = resolveSlug(role).llm.model;

  if (!context) {
    return { model: fallbackModel, ruleName: null };
  }

  // Agent rules take priority over global rules — check them first (sorted by priority desc)
  const sortedAgentRules = [...(agentRoutingRules ?? [])].sort((a, b) => b.priority - a.priority);
  for (const rule of sortedAgentRules) {
    if (matchesRule(rule, context)) {
      return { model: rule.model, ruleName: rule.id };
    }
  }

  // Then global rules
  const sortedGlobalRules = loadGlobalRoutingRules().sort((a, b) => b.priority - a.priority);
  for (const rule of sortedGlobalRules) {
    if (matchesRule(rule, context)) {
      return { model: rule.model, ruleName: rule.id };
    }
  }

  return { model: fallbackModel, ruleName: null };
}

export function resolveModel(
  role: string,
  context?: RoutingContext,
  agentRoutingRules?: RoutingRule[]
): string {
  return resolveModelResult(role, context, agentRoutingRules).model;
}

export function resolveParameters(role: string): Record<string, unknown> {
  return resolveSlug(role).llm.parameters;
}

// --- Parser ---

function parsePlan(raw: Record<string, unknown>, filename: string): Plan {
  const name = raw.name as string;
  if (!name) throw new Error(`[llm] plan in ${filename} missing "name"`);

  const rawSlugs = raw.slugs as Record<string, Record<string, unknown>> | undefined;
  if (!rawSlugs) throw new Error(`[llm] plan "${name}" missing "slugs"`);

  const slugs: Record<string, SlugDef> = {};
  for (const slugName of ALL_SLUGS) {
    const s = rawSlugs[slugName];
    if (!s) throw new Error(`[llm] plan "${name}" missing slug "${slugName}"`);

    const llm = s.llm as Record<string, unknown> | undefined;
    if (!llm?.model) throw new Error(`[llm] plan "${name}" slug "${slugName}" missing llm.model`);

    slugs[slugName] = {
      slug: slugName,
      class: s.class as SlugClass,
      effort: s.effort as SlugEffort,
      llm: {
        model: llm.model as string,
        parameters: (llm.parameters as Record<string, unknown>) ?? {},
      },
      tags: (s.tags as string[]) ?? [],
      title: (s.title as string) ?? slugName,
      description: (s.description as string) ?? "",
    };
  }

  const roles = raw.roles as Record<string, string> | undefined;
  if (!roles) throw new Error(`[llm] plan "${name}" missing "roles"`);

  return {
    name,
    title: (raw.title as string) ?? name,
    description: (raw.description as string) ?? "",
    slugs: slugs as Record<SlugName, SlugDef>,
    roles: roles as Record<string, SlugName>,
  };
}
