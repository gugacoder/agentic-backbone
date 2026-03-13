import type { TwilioConfig } from "./types.js";
import type { ChannelConfig } from "../../channels/types.js";

export function loadTwilioConfigFromChannel(channel: ChannelConfig): TwilioConfig {
  const m = channel.options;

  const accountSid = m["twilio-account-sid"] as string | undefined;
  const authToken = m["twilio-auth-token"] as string | undefined;
  const phoneNumber = m["twilio-phone-number"] as string | undefined;

  if (!accountSid) throw new Error(`[twilio] channel ${channel.slug} missing twilio-account-sid`);
  if (!authToken) throw new Error(`[twilio] channel ${channel.slug} missing twilio-auth-token`);
  if (!phoneNumber) throw new Error(`[twilio] channel ${channel.slug} missing twilio-phone-number`);

  const callbackBaseUrl = loadCallbackBaseUrl(process.env);

  return {
    accountSid,
    authToken,
    phoneNumber,
    callbackBaseUrl,
    language: (m["twilio-language"] as string) || "pt-BR",
    voice: (m["twilio-voice"] as string) || "Polly.Camila",
    endCallToken: "[FIM_LIGACAO]",
  };
}

export function loadCallbackBaseUrl(env: Record<string, string | undefined>): string {
  if (env.NGROK_DOMAIN) {
    return `https://${env.NGROK_DOMAIN}`;
  }
  if (env.BACKBONE_CALLBACK_HOST && env.BACKBONE_PORT) {
    return `http://${env.BACKBONE_CALLBACK_HOST}:${env.BACKBONE_PORT}`;
  }
  throw new Error("[twilio] NGROK_DOMAIN or BACKBONE_CALLBACK_HOST + BACKBONE_PORT is required");
}
