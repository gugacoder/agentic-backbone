import type { TwilioConfig } from "./types.js";
import type { ChannelConfig } from "../../channels/types.js";
import { getNgrokStatus } from "../../ngrok/index.js";

let cachedNgrokUrl: string | null = null;
let cachedAdapterCredential: Record<string, string> | null = null;

export async function resolveAdapterCredential(): Promise<Record<string, string> | null> {
  if (cachedAdapterCredential) return cachedAdapterCredential;
  try {
    const { connectorRegistry } = await import("../index.js");
    const adapter = connectorRegistry.findAdapter("twilio");
    if (adapter?.credential) {
      cachedAdapterCredential = adapter.credential as Record<string, string>;
      return cachedAdapterCredential;
    }
  } catch { /* not loaded yet */ }
  return null;
}

export function loadTwilioConfigFromChannel(channel: ChannelConfig): TwilioConfig {
  const m = channel.options;

  let accountSid = m["twilio-account-sid"] as string | undefined;
  let authToken = m["twilio-auth-token"] as string | undefined;
  let phoneNumber = m["twilio-phone-number"] as string | undefined;

  // Fallback: resolve from cached adapter credentials
  if ((!accountSid || !authToken || !phoneNumber) && cachedAdapterCredential) {
    const cred = cachedAdapterCredential;
    if (!accountSid) accountSid = cred.account_sid ?? cred.accountSid;
    if (!authToken) authToken = cred.auth_token ?? cred.authToken;
    if (!phoneNumber) phoneNumber = cred.phoneNumber;
  }

  if (!accountSid) throw new Error(`[twilio] channel ${channel.slug} missing twilio-account-sid`);
  if (!authToken) throw new Error(`[twilio] channel ${channel.slug} missing twilio-auth-token`);
  if (!phoneNumber) throw new Error(`[twilio] channel ${channel.slug} missing twilio-phone-number`);

  const callbackBaseUrl = resolveCallbackBaseUrl();
  if (!callbackBaseUrl) {
    throw new Error("[twilio] no callback URL available (ngrok not running, NGROK_DOMAIN and BACKBONE_CALLBACK_HOST not set)");
  }

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

function resolveCallbackBaseUrl(): string | null {
  const env = process.env;

  if (env.NGROK_DOMAIN) {
    return `https://${env.NGROK_DOMAIN}`;
  }

  if (cachedNgrokUrl) {
    return cachedNgrokUrl;
  }

  if (env.BACKBONE_CALLBACK_HOST && env.BACKBONE_PORT) {
    return `http://${env.BACKBONE_CALLBACK_HOST}:${env.BACKBONE_PORT}`;
  }

  return null;
}

/** Refresh cached ngrok URL — call on startup and periodically */
export async function refreshNgrokUrl(): Promise<void> {
  try {
    const status = await getNgrokStatus();
    cachedNgrokUrl = status.url ?? null;
  } catch {
    cachedNgrokUrl = null;
  }
}

/** For backward compatibility */
export function loadCallbackBaseUrl(env: Record<string, string | undefined>): string {
  if (env.NGROK_DOMAIN) {
    return `https://${env.NGROK_DOMAIN}`;
  }
  if (cachedNgrokUrl) {
    return cachedNgrokUrl;
  }
  if (env.BACKBONE_CALLBACK_HOST && env.BACKBONE_PORT) {
    return `http://${env.BACKBONE_CALLBACK_HOST}:${env.BACKBONE_PORT}`;
  }
  throw new Error("[twilio] NGROK_DOMAIN or BACKBONE_CALLBACK_HOST + BACKBONE_PORT is required");
}
