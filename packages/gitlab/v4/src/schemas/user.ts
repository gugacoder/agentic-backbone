import { z } from "zod";

export const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  username: z.string(),
  email: z.string().optional(),
  avatar_url: z.string().nullable().optional(),
  web_url: z.string().optional(),
  state: z.string().optional(),
  created_at: z.string().optional(),
}).passthrough();

export type User = z.infer<typeof UserSchema>;
