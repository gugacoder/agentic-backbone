import { z } from "zod";
import { UserRefSchema } from "./common.js";

export const ReleaseSchema = z.object({
  tag_name: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  created_at: z.string(),
  released_at: z.string().optional(),
  author: UserRefSchema.optional(),
  commit: z.object({ id: z.string(), short_id: z.string(), title: z.string() }).passthrough().optional(),
}).passthrough();

export type Release = z.infer<typeof ReleaseSchema>;
