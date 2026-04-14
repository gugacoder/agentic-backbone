import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { plansDir, settingsPath } from "../context/paths.js";
import { readYaml, writeYaml } from "../context/readers.js";

// --- Provider ---

export type LlmProvider = string;

/** Known providers with pre-configured base URLs and API key env vars. */
const PROVIDER_CONFIGS: Record<string, { baseURL: string; apiKeyEnv: string; maxTools?: number }> = {
  openrouter: { baseURL: "https://openrouter.ai/api/v1", apiKeyEnv: "OPENROUTER_API_KEY" },
  groq:       { baseURL: "https://api.groq.com/openai/v1", apiKeyEnv: "GROQ_API_KEY", maxTools: 128 },
};

export function getProviderConfig(provider: string): { baseURL: string; apiKeyEnv: string; maxTools?: number } | undefined {
  return PROVIDER_CONFIGS[provider];
}

// --- Types ---

export type SlugClass = "small" | "medium" | "large";
export type SlugEffort = "low" | "mid" | "high";
export type SlugName = `${SlugClass}.${SlugEffort}`;

export interface SlugDef {
  slug: SlugName;
  class: SlugClass;
  effort: SlugEffort;
  llm: { provider: LlmProvider; model?: string; parameters: Record<string, unknown> };
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

const slugDefRawSchema = z.object({
  class: z.enum(["small", "medium", "large"]),
  effort: z.enum(["low", "mid", "high"]),
  llm: z.object({
    provider: z.string().min(1, "llm.provider is required"),
    model: z.string().optional(),
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

export interface ResolvedLlm {
  model?: string;
  provider: LlmProvider;
  parameters: Record<string, unknown>;
}

export function resolveSlug(role: string): SlugDef {
  const plan = getActivePlan();
  const slugName = plan.roles[role] ?? DEFAULT_SLUG;
  const slug = plan.slugs[slugName];
  if (!slug) {
    const fallback = plan.slugs[DEFAULT_SLUG];
    if (!fallback) {
      throw new Error(`[llm] no slug "${slugName}" and no fallback "${DEFAULT_SLUG}" in plan "${plan.name}"`);
    }
    return fallback;
  }
  return slug;
}

/** Resolve by role name (conversation, heartbeat, cron, memory). */
export function resolve(role: string): ResolvedLlm {
  const slug = resolveSlug(role);
  return { model: slug.llm.model, provider: slug.llm.provider, parameters: slug.llm.parameters };
}

/** Resolve by slug name directly (e.g. "medium.mid", "small.low"). */
export function resolveBySlug(slugName: SlugName): ResolvedLlm {
  const plan = getActivePlan();
  const slug = plan.slugs[slugName];
  if (!slug) {
    throw new Error(`[llm] slug "${slugName}" not found in plan "${plan.name}"`);
  }
  return { model: slug.llm.model, provider: slug.llm.provider, parameters: slug.llm.parameters };
}

/** @deprecated Use resolve(role) instead. Will be removed after migration. */
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
