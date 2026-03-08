import { z } from "zod";

export const credentialSchema = z.object({
  incoming_webhook_url: z.string().url().describe("Microsoft Teams Incoming Webhook URL"),
  bot_endpoint_secret: z
    .string()
    .describe("Shared secret to validate inbound Power Automate requests"),
});

export const optionsSchema = z.object({
  adaptive_cards: z.boolean().default(false).describe("Send messages as Adaptive Cards"),
});
