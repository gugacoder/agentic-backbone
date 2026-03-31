import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { plansDir, settingsPath } from "../context/paths.js";
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
  provider: LlmProvider;
  ruleName: string | null;
}

// --- Provider ---

export type LlmProvider = "openrouter" | "groq";

const PROVIDER_CONFIGS: Record<LlmProvider, { baseURL: string; apiKeyEnv: string; maxTools?: number }> = {
  openrouter: { baseURL: "https://openrouter.ai/api/v1", apiKeyEnv: "OPENROUTER_API_KEY" },
  groq:       { baseURL: "https://api.groq.com/openai/v1", apiKeyEnv: "GROQ_API_KEY", maxTools: 128 },
};

export function getProviderConfig(provider: LlmProvider): { baseURL: string; apiKeyEnv: string; maxTools?: number } {
  return PROVIDER_CONFIGS[provider] ?? PROVIDER_CONFIGS.openrouter;
}

// --- Types ---

export type SlugClass = "small" | "medium" | "large";
export type SlugEffort = "low" | "mid" | "high";
export type SlugName = `${SlugClass}.${SlugEffort}`;

export interface SlugDef {
  slug: SlugName;
  class: SlugClass;
  effort: SlugEffort;
  llm: { provider: LlmProvider; model: string; parameters: Record<string, unknown> };
  tags: string[];
  title: string;
  description: string;
}

export interface Plan {
  name: string;
  tier: number;
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

// --- Zod Schema ---

const llmProviderSchema = z.enum(["openrouter", "groq"]).default("openrouter");

const slugDefRawSchema = z.object({
  class: z.enum(["small", "medium", "large"]),
  effort: z.enum(["low", "mid", "high"]),
  llm: z.object({
    provider: llmProviderSchema,
    model: z.string().min(1, "llm.model is required"),
    parameters: z.record(z.unknown()).default({}),
  }),
  tags: z.array(z.string()).default([]),
  title: z.string().default(""),
  description: z.string().default(""),
});

const slugsRawSchema = z.object(
  Object.fromEntries(ALL_SLUGS.map((s) => [s, slugDefRawSchema])) as Record<SlugName, typeof slugDefRawSchema>,
);

const planRawSchema = z.object({
  name: z.string().min(1, "name is required"),
  tier: z.number({ required_error: "tier is required" }).int().min(0, "tier must be >= 0"),
  title: z.string().min(1, "title is required"),
  description: z.string().default(""),
  slugs: slugsRawSchema,
  roles: z.record(z.string()).refine(
    (r) => Object.keys(r).length > 0,
    "roles must have at least one entry",
  ),
});

// --- Cache ---

let plans: Map<string, Plan> = new Map();
let activePlanName = "";

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
  return [...plans.values()].sort((a, b) => a.tier - b.tier);
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
  const slug = resolveSlug(role);
  const fallbackModel = slug.llm.model;
  const fallbackProvider = slug.llm.provider;

  if (!context) {
    return { model: fallbackModel, provider: fallbackProvider, ruleName: null };
  }

  // Agent rules take priority over global rules — check them first (sorted by priority desc)
  const sortedAgentRules = [...(agentRoutingRules ?? [])].sort((a, b) => b.priority - a.priority);
  for (const rule of sortedAgentRules) {
    if (matchesRule(rule, context)) {
      return { model: rule.model, provider: fallbackProvider, ruleName: rule.id };
    }
  }

  // Then global rules
  const sortedGlobalRules = loadGlobalRoutingRules().sort((a, b) => b.priority - a.priority);
  for (const rule of sortedGlobalRules) {
    if (matchesRule(rule, context)) {
      return { model: rule.model, provider: fallbackProvider, ruleName: rule.id };
    }
  }

  return { model: fallbackModel, provider: fallbackProvider, ruleName: null };
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
  const result = planRawSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`[llm] invalid plan "${filename}":\n${issues}`);
  }

  const parsed = result.data;
  const slugs: Record<string, SlugDef> = {};
  for (const slugName of ALL_SLUGS) {
    const s = parsed.slugs[slugName];
    slugs[slugName] = {
      slug: slugName,
      class: s.class,
      effort: s.effort,
      llm: {
        provider: s.llm.provider as LlmProvider,
        model: s.llm.model,
        parameters: s.llm.parameters,
      },
      tags: s.tags,
      title: s.title || slugName,
      description: s.description,
    };
  }

  return {
    name: parsed.name,
    tier: parsed.tier,
    title: parsed.title,
    description: parsed.description,
    slugs: slugs as Record<SlugName, SlugDef>,
    roles: parsed.roles as Record<string, SlugName>,
  };
}
