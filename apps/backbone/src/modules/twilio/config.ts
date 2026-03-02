import type { TwilioConfig } from "./types.js";

export function loadTwilioConfig(env: Record<string, string | undefined>): TwilioConfig {
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  const phoneNumber = env.TWILIO_PHONE_NUMBER;

  if (!accountSid) throw new Error("[twilio] TWILIO_ACCOUNT_SID is required");
  if (!authToken) throw new Error("[twilio] TWILIO_AUTH_TOKEN is required");
  if (!phoneNumber) throw new Error("[twilio] TWILIO_PHONE_NUMBER is required");

  let callbackBaseUrl: string;

  if (env.NGROK_DOMAIN) {
    callbackBaseUrl = `https://${env.NGROK_DOMAIN}`;
  } else if (env.BACKBONE_CALLBACK_HOST && env.BACKBONE_PORT) {
    callbackBaseUrl = `http://${env.BACKBONE_CALLBACK_HOST}:${env.BACKBONE_PORT}`;
  } else {
    throw new Error("[twilio] NGROK_DOMAIN or BACKBONE_CALLBACK_HOST + BACKBONE_PORT is required");
  }

  return {
    accountSid,
    authToken,
    phoneNumber,
    callbackBaseUrl,
    language: "pt-BR",
    voice: "Polly.Camila",
    endCallToken: "[FIM_LIGACAO]",
  };
}
