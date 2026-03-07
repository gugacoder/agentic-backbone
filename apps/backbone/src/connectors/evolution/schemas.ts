import { z } from "zod";

export const credentialSchema = z.object({
  host: z.string(),
  api_key: z.string(),
});

export const optionsSchema = z.object({
  instance_name: z.string().optional(),
  timeout: z.coerce.number().default(5000),
});
