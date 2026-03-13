import { z } from "zod";
import { UserRefSchema } from "./common.js";

export const MrSchema = z.object({
  id: z.number(),
  iid: z.number(),
  project_id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  state: z.enum(["opened", "closed", "locked", "merged"]),
  source_branch: z.string(),
  target_branch: z.string(),
  author: UserRefSchema,
  assignees: z.array(UserRefSchema),
  reviewers: z.array(UserRefSchema).optional(),
  labels: z.array(z.string()),
  merge_status: z.string().optional(),
  has_conflicts: z.boolean().optional(),
  web_url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  merged_at: z.string().nullable().optional(),
}).passthrough();

export type Mr = z.infer<typeof MrSchema>;

export const MrDiffSchema = z.object({
  diff: z.string(),
  new_path: z.string(),
  old_path: z.string(),
  new_file: z.boolean(),
  renamed_file: z.boolean(),
  deleted_file: z.boolean(),
}).passthrough();

export type MrDiff = z.infer<typeof MrDiffSchema>;

export const MrApprovalsSchema = z.object({
  approvals_required: z.number(),
  approvals_left: z.number(),
  approved_by: z.array(z.object({ user: UserRefSchema }).passthrough()),
  approved: z.boolean(),
}).passthrough();

export type MrApprovals = z.infer<typeof MrApprovalsSchema>;

export const MrNoteSchema = z.object({
  id: z.number(),
  body: z.string(),
  author: UserRefSchema,
  created_at: z.string(),
  updated_at: z.string(),
  system: z.boolean(),
}).passthrough();

export type MrNote = z.infer<typeof MrNoteSchema>;
