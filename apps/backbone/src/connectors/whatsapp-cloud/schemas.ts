import { z } from "zod";

export const credentialSchema = z.object({
  access_token: z.string(),
  phone_number_id: z.string(),
  webhook_verify_token: z.string(),
  business_account_id: z.string(),
  app_secret: z.string(),
});

export const optionsSchema = z.object({
  api_version: z.string().default("v19.0"),
  auto_reply_read: z.boolean().default(true),
});
