import { z } from "zod";

// ── AGENT.yml ────────────────────────────────────────────

export const AgentYmlSchema = z
  .object({
    id: z.string().optional(),
    owner: z.string().optional(),
    slug: z.string().optional(),
    delivery: z.string().default(""),
    enabled: z.boolean().default(false),
    "heartbeat-enabled": z.boolean().default(false),
    "heartbeat-interval": z.number().int().positive().default(30_000),
    description: z.string().default(""),
  })
  .passthrough();

export type AgentYml = z.infer<typeof AgentYmlSchema>;

// ── USER.md frontmatter ──────────────────────────────────

export const UserMdSchema = z.object({
  slug: z.string().optional(),
  displayName: z.string().optional(),
  email: z.string().default(""),
  role: z.string().optional(),
  canCreateAgents: z.boolean().default(true),
  canCreateChannels: z.boolean().default(true),
  maxAgents: z.number().int().positive().default(5),
});

export type UserMd = z.infer<typeof UserMdSchema>;

// ── credential.yml ───────────────────────────────────────

export const CredentialYmlSchema = z.object({
  type: z.literal("user-password").default("user-password"),
  email: z.string().default(""),
  password: z.string().optional(),
});

export type CredentialYml = z.infer<typeof CredentialYmlSchema>;

// ── CHANNEL.yml ──────────────────────────────────────────

export const ChannelYmlSchema = z
  .object({
    slug: z.string().optional(),
    owner: z.string().optional(),
    type: z.string().default("generic"),
    description: z.string().default(""),
  })
  .passthrough();

export type ChannelYml = z.infer<typeof ChannelYmlSchema>;

// ── SESSION.yml ──────────────────────────────────────────

export const SessionYmlSchema = z.object({
  "session-id": z.string(),
  "user-id": z.string(),
  "agent-id": z.string(),
  "created-at": z.string(),
  "message-count": z.number().int().nonnegative().default(0),
});

export type SessionYml = z.infer<typeof SessionYmlSchema>;

// ── cron/{slug}.yml ──────────────────────────────────────

export const CronYmlSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().default(true),
  "schedule-kind": z.enum(["at", "every", "cron"]),
  "schedule-at": z.string().optional(),
  "schedule-everyMs": z.number().optional(),
  "schedule-anchorMs": z.number().optional(),
  "schedule-expr": z.string().optional(),
  "schedule-tz": z.string().optional(),
  "payload-kind": z
    .enum(["heartbeat", "conversation", "request"])
    .default("heartbeat"),
  "payload-message": z.string().optional(),
  deleteAfterRun: z.boolean().optional(),
  description: z.string().default(""),
});

export type CronYml = z.infer<typeof CronYmlSchema>;

// ── SKILL.md frontmatter ─────────────────────────────────

export const SkillMdSchema = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    enabled: z.boolean().default(true),
    "user-invocable": z.boolean().optional(),
    trigger: z.string().optional(),
  })
  .passthrough();

export type SkillMd = z.infer<typeof SkillMdSchema>;

// ── SERVICE.md frontmatter ───────────────────────────────

export const ServiceMdSchema = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    enabled: z.boolean().default(true),
    "skip-agent": z.boolean().optional(),
  })
  .passthrough();

export type ServiceMd = z.infer<typeof ServiceMdSchema>;

// ── ADAPTER.yml ──────────────────────────────────────────

export const AdapterYmlSchema = z
  .object({
    connector: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    policy: z.enum(["readonly", "readwrite"]).default("readonly"),
    credential: z.record(z.unknown()).optional(),
    params: z.record(z.unknown()).optional(),
    options: z.record(z.unknown()).optional(),
  })
  .passthrough();

export type AdapterYml = z.infer<typeof AdapterYmlSchema>;
