import { z } from "zod";

export const credentialSchema = z.object({
  host: z.string(),
  port: z.coerce.number().default(5432),
  database: z.string(),
  user: z.string(),
  password: z.string(),
});

export const optionsSchema = z.object({
  max: z.coerce.number().default(10),
});
