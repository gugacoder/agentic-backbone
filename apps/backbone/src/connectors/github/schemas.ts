import { z } from "zod";

export const credentialSchema = z.object({
  token: z.string().min(1),
});

export const optionsSchema = z.object({
  default_repo: z.string().optional(),
});
