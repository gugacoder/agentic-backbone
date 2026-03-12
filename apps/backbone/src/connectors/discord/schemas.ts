import { z } from "zod";

export const credentialSchema = z.object({
  bot_token: z.string().min(1),
});

export const optionsSchema = z.object({
  default_guild_id: z.string().optional(),
});
