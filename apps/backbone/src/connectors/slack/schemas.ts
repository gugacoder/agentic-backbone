import { z } from "zod";

export const credentialSchema = z.object({
  bot_token: z.string().describe("Slack Bot User OAuth Token (xoxb-...)"),
  signing_secret: z.string().describe("Slack Signing Secret for request verification"),
  app_token: z.string().optional().describe("Slack App-Level Token (xapp-...) for Socket Mode"),
});

export const optionsSchema = z.object({
  listen_events: z
    .array(z.string())
    .default(["app_mention", "message"])
    .describe("Slack event types to process"),
  channel_whitelist: z
    .array(z.string())
    .default([])
    .describe("If non-empty, only process messages from these channel IDs"),
});
