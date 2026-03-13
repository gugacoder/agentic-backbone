import { z } from "zod";

export const UserRefSchema = z.object({
  id: z.number(),
  name: z.string(),
  username: z.string(),
  avatar_url: z.string().nullable().optional(),
}).passthrough();

export type UserRef = z.infer<typeof UserRefSchema>;

export const TimeStatsSchema = z.object({
  time_estimate: z.number(),
  total_time_spent: z.number(),
}).passthrough();

export type TimeStats = z.infer<typeof TimeStatsSchema>;
