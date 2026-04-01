import { randomInt, timingSafeEqual } from "node:crypto";
import { getOtpConfig } from "../settings/otp.js";

interface OtpEntry {
  code: string;
  expiresAt: number;
}

const otpStore = new Map<string, OtpEntry>();
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_LENGTH = 6;

// Clean expired entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of otpStore) {
    if (entry.expiresAt <= now) {
      otpStore.delete(key);
    }
  }
}, 2 * 60 * 1000).unref();

function generateCode(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

export async function sendOtp(username: string, phoneNumber: string): Promise<void> {
  const config = getOtpConfig();
  if (!config.enabled || !config.evolution) {
    throw new Error("OTP não está habilitado");
  }

  const code = generateCode();

  otpStore.set(username, {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
  });

  const { host, "api-key": apiKey, instance } = config.evolution;
  const url = `${host}/message/sendText/${instance}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: JSON.stringify({
      number: phoneNumber,
      text: `Seu código de acesso: ${code}`,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Evolution API error ${response.status}: ${body}`);
  }
}

export function verifyOtp(username: string, code: string): boolean {
  const entry = otpStore.get(username);
  if (!entry) return false;

  if (entry.expiresAt <= Date.now()) {
    otpStore.delete(username);
    return false;
  }

  const a = Buffer.from(code.padEnd(OTP_LENGTH, "\0"), "utf-8");
  const b = Buffer.from(entry.code.padEnd(OTP_LENGTH, "\0"), "utf-8");

  if (a.length !== b.length) return false;

  const valid = timingSafeEqual(a, b);
  if (valid) {
    otpStore.delete(username); // one-time use
  }
  return valid;
}
