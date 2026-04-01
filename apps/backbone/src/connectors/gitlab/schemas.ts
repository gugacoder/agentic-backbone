import { z } from "zod";

export const credentialSchema = z.object({
  base_url: z.string().default("https://gitlab.com"),
  token: z.string().min(1),
});

export const optionsSchema = z.object({
  default_project: z.string().min(1),
});
