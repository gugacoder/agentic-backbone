import { z } from "zod";

// ── AGENT.yml ────────────────────────────────────────────

export const AgentYmlSchema = z.object({
  id: z.string().optional(),
  owner: z.string().optional(),
  slug: z.string().optional(),
  name: z.string().optional(),
  delivery: z.string().default(""),
  enabled: z.boolean().default(false),
  "heartbeat-enabled": z.boolean().default(false),
  "heartbeat-interval": z.number().int().positive().default(30_000),
  description: z.string().default(""),
  role: z.string().optional(),
  members: z.array(z.string()).optional(),
  quotas: z.record(z.string(), z.unknown()).optional(),
  adapters: z.array(z.string()).optional(),
  "tool-approvals": z
    .record(
      z.string(),
      z.object({
        label: z.string().optional(),
        timeout: z.number().int().positive().default(300),
      })
    )
    .optional(),
});

export type AgentYml = z.infer<typeof AgentYmlSchema>;

// ── USER.md (frontmatter) ────────────────────────────────

export const AddressSchema = z.object({
  street: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  timezone: z.string().optional(),
});

export type Address = z.infer<typeof AddressSchema>;

export const UserMdSchema = z.object({
  slug: z.string().optional(),
  displayName: z.string().optional(),
  email: z.string().default(""),
  phoneNumber: z.string().optional(),
  role: z.string().optional(),
  canCreateAgents: z.boolean().default(true),
  canCreateChannels: z.boolean().default(true),
  maxAgents: z.number().int().positive().default(5),
  address: AddressSchema.optional(),
});

export type UserMd = z.infer<typeof UserMdSchema>;

// ── credentials/users/{slug}.yml ─────────────────────────

export const UserCredentialYmlSchema = z.object({
  type: z.literal("user-password").default("user-password"),
  password: z.string().optional(),
});

export type UserCredentialYml = z.infer<typeof UserCredentialYmlSchema>;

// ── CHANNEL.yml ──────────────────────────────────────────

export const ChannelYmlSchema = z.object({
  slug: z.string().optional(),
  owner: z.string().optional(),
  type: z.string().default("generic"),
  description: z.string().default(""),
  agent: z.string().optional(),
  "channel-adapter": z.string().optional(),
  instructions: z.string().optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});

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

export const SkillMdSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  "user-invocable": z.boolean().optional(),
  trigger: z.string().optional(),
});

export type SkillMd = z.infer<typeof SkillMdSchema>;

// ── SERVICE.md frontmatter ───────────────────────────────

export const ServiceMdSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  "skip-agent": z.boolean().optional(),
});

export type ServiceMd = z.infer<typeof ServiceMdSchema>;

// ── ADAPTER.yml ──────────────────────────────────────────

export const AdapterYmlSchema = z.object({
  connector: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean().default(false),
  policy: z.enum(["readonly", "readwrite"]).default("readonly"),
  credential: z.record(z.unknown()).optional(),
  params: z.record(z.unknown()).optional(),
  options: z.record(z.unknown()).optional(),
});

export type AdapterYml = z.infer<typeof AdapterYmlSchema>;
