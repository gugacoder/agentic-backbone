import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { isSensitiveField } from "./sensitive.js";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX = "ENC(";
const SUFFIX = ")";

let cachedKey: Buffer | null = null;

function deriveKey(secret: string): Buffer {
  if (cachedKey) return cachedKey;
  const salt = Buffer.from("agentic-backbone-encryption-salt", "utf-8");
  cachedKey = scryptSync(secret, salt, KEY_LENGTH);
  return cachedKey;
}

function getKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required for encryption");
  return deriveKey(secret);
}

export function isEncrypted(value: string): boolean {
  return typeof value === "string" && value.startsWith(PREFIX) && value.endsWith(SUFFIX);
}

export function encryptValue(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: iv + authTag + ciphertext, all base64-encoded
  const payload = Buffer.concat([iv, authTag, encrypted]).toString("base64");
  return `${PREFIX}${payload}${SUFFIX}`;
}

export function decryptValue(encrypted: string): string {
  if (!isEncrypted(encrypted)) throw new Error("Value is not encrypted");

  const key = getKey();
  const payload = Buffer.from(encrypted.slice(PREFIX.length, -SUFFIX.length), "base64");

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf-8");
}

export function processYamlFields(
  obj: Record<string, unknown>,
  direction: "encrypt" | "decrypt"
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = processYamlFields(value as Record<string, unknown>, direction);
    } else if (typeof value === "string" && isSensitiveField(key)) {
      if (direction === "encrypt" && !isEncrypted(value) && value !== "" && !/^\$\{.+\}$/.test(value)) {
        result[key] = encryptValue(value);
      } else if (direction === "decrypt" && isEncrypted(value)) {
        result[key] = decryptValue(value);
      } else {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}
