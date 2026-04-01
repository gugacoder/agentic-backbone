import { z } from "zod";

export const credentialSchema = z.object({
  account_sid: z.string(),
  auth_token: z.string(),
});

export const optionsSchema = z.object({});
