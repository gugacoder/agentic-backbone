import { z } from "zod";
import { UserRefSchema, TimeStatsSchema } from "./common.js";

export const IssueSchema = z.object({
  id: z.number(),
  iid: z.number(),
  project_id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  state: z.enum(["opened", "closed"]),
  labels: z.array(z.string()),
  assignees: z.array(UserRefSchema),
  author: UserRefSchema,
  milestone: z.any().nullable(),
  due_date: z.string().nullable(),
  web_url: z.string(),
  time_stats: TimeStatsSchema,
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
}).passthrough();

export type Issue = z.infer<typeof IssueSchema>;

export const NoteSchema = z.object({
  id: z.number(),
  body: z.string(),
  author: UserRefSchema,
  created_at: z.string(),
  updated_at: z.string(),
  system: z.boolean(),
}).passthrough();

export type Note = z.infer<typeof NoteSchema>;

export const IssueLinkSchema = z.object({
  source_issue: IssueSchema.optional(),
  target_issue: IssueSchema.optional(),
  link_type: z.enum(["relates_to", "blocks", "is_blocked_by"]).optional(),
}).passthrough();

export type IssueLink = z.infer<typeof IssueLinkSchema>;
