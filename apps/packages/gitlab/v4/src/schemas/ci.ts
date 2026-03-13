import { z } from "zod";

export const PipelineStatusSchema = z.enum([
  "created",
  "waiting_for_resource",
  "preparing",
  "pending",
  "running",
  "success",
  "failed",
  "canceled",
  "skipped",
  "manual",
  "scheduled",
]);

export type PipelineStatus = z.infer<typeof PipelineStatusSchema>;

export const PipelineSchema = z.object({
  id: z.number(),
  iid: z.number().optional(),
  project_id: z.number(),
  status: PipelineStatusSchema,
  ref: z.string(),
  sha: z.string(),
  web_url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();

export type Pipeline = z.infer<typeof PipelineSchema>;

export const JobStatusSchema = z.enum([
  "created",
  "pending",
  "running",
  "failed",
  "success",
  "canceled",
  "skipped",
  "manual",
  "scheduled",
]);

export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobSchema = z.object({
  id: z.number(),
  name: z.string(),
  stage: z.string(),
  status: JobStatusSchema,
  ref: z.string(),
  web_url: z.string(),
  created_at: z.string(),
  started_at: z.string().nullable().optional(),
  finished_at: z.string().nullable().optional(),
  duration: z.number().nullable().optional(),
  runner: z.object({ id: z.number(), description: z.string() }).passthrough().nullable().optional(),
}).passthrough();

export type Job = z.infer<typeof JobSchema>;
