import { z } from "zod";
import { UserRefSchema } from "./common.js";

export const BranchSchema = z.object({
  name: z.string(),
  protected: z.boolean().optional(),
  default: z.boolean().optional(),
  web_url: z.string().optional(),
  merged: z.boolean().optional(),
  commit: z.object({
    id: z.string(),
    short_id: z.string(),
    title: z.string(),
    authored_date: z.string().optional(),
    committed_date: z.string().optional(),
  }).passthrough().optional(),
}).passthrough();

export type Branch = z.infer<typeof BranchSchema>;

export const TagSchema = z.object({
  name: z.string(),
  message: z.string().nullable().optional(),
  target: z.string().optional(),
  commit: z.object({
    id: z.string(),
    short_id: z.string(),
    title: z.string(),
    authored_date: z.string().optional(),
    committed_date: z.string().optional(),
  }).passthrough().optional(),
  release: z.any().nullable().optional(),
}).passthrough();

export type Tag = z.infer<typeof TagSchema>;

export const CommitSchema = z.object({
  id: z.string(),
  short_id: z.string(),
  title: z.string(),
  message: z.string().optional(),
  author_name: z.string().optional(),
  author_email: z.string().optional(),
  authored_date: z.string().optional(),
  committer_name: z.string().optional(),
  committer_email: z.string().optional(),
  committed_date: z.string().optional(),
  web_url: z.string().optional(),
  parent_ids: z.array(z.string()).optional(),
}).passthrough();

export type Commit = z.infer<typeof CommitSchema>;

export const FileContentSchema = z.object({
  file_name: z.string(),
  file_path: z.string(),
  size: z.number().optional(),
  encoding: z.string(),
  content: z.string(),
  content_sha256: z.string().optional(),
  ref: z.string(),
  blob_id: z.string().optional(),
  commit_id: z.string().optional(),
  last_commit_id: z.string().optional(),
}).passthrough();

export type FileContent = z.infer<typeof FileContentSchema>;

export const TreeItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["blob", "tree"]),
  path: z.string(),
  mode: z.string().optional(),
}).passthrough();

export type TreeItem = z.infer<typeof TreeItemSchema>;

export const CommitDiffSchema = z.object({
  diff: z.string(),
  new_path: z.string(),
  old_path: z.string(),
  new_file: z.boolean(),
  renamed_file: z.boolean(),
  deleted_file: z.boolean(),
}).passthrough();

export type CommitDiff = z.infer<typeof CommitDiffSchema>;

export const CompareResultSchema = z.object({
  commit: CommitSchema.optional(),
  commits: z.array(CommitSchema).optional(),
  diffs: z.array(CommitDiffSchema).optional(),
  compare_timeout: z.boolean().optional(),
  compare_same_ref: z.boolean().optional(),
}).passthrough();

export type CompareResult = z.infer<typeof CompareResultSchema>;
