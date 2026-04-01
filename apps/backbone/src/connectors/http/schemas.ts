import { z } from "zod";

export const credentialSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  apiKeyHeader: z.string().optional().default("Authorization"),
  apiKeyPrefix: z.string().optional().default("Bearer"),
});

export const optionsSchema = z.object({
  timeoutMs: z.coerce.number().default(30000),
});
