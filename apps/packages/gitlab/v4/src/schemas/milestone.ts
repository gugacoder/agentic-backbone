import { z } from "zod";

export const MilestoneSchema = z.object({
  id: z.number(),
  iid: z.number(),
  project_id: z.number(),
  title: z.string(),
  description: z.string().nullable().optional(),
  state: z.enum(["active", "closed"]),
  due_date: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  web_url: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();

export type Milestone = z.infer<typeof MilestoneSchema>;
