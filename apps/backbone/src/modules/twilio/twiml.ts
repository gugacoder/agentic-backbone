import type { TwilioConfig } from "./types.js";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildSayAndGatherTwiml(
  config: TwilioConfig,
  text: string,
  callSid: string,
): string {
  const actionUrl = `${config.callbackBaseUrl}/api/v1/ai/modules/twilio/webhook/gather?callSid=${encodeURIComponent(callSid)}`;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `<Say voice="${escapeXml(config.voice)}" language="${escapeXml(config.language)}">${escapeXml(text)}</Say>`,
    `<Gather input="speech" language="${escapeXml(config.language)}" action="${escapeXml(actionUrl)}" method="POST" speechTimeout="auto"/>`,
    "</Response>",
  ].join("");
}

export function buildHangupTwiml(config: TwilioConfig, text: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `<Say voice="${escapeXml(config.voice)}" language="${escapeXml(config.language)}">${escapeXml(text)}</Say>`,
    "<Hangup/>",
    "</Response>",
  ].join("");
}

export function parseEndCallSignal(
  text: string,
  token: string,
): { shouldEnd: boolean; cleanText: string } {
  if (!text.includes(token)) {
    return { shouldEnd: false, cleanText: text };
  }

  const cleanText = text.replace(token, "").trim();
  return { shouldEnd: true, cleanText };
}
