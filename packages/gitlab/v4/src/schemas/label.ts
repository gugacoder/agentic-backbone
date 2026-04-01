import { z } from "zod";

export const LabelSchema = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string(),
  description: z.string().nullable().optional(),
  priority: z.number().nullable().optional(),
  open_issues_count: z.number().optional(),
  closed_issues_count: z.number().optional(),
  open_merge_requests_count: z.number().optional(),
}).passthrough();

export type Label = z.infer<typeof LabelSchema>;
