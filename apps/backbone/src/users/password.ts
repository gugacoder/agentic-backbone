import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

function isBcryptHash(stored: string): boolean {
  return /^\$2[aby]\$/.test(stored);
}

export async function verifyPassword(
  input: string,
  stored: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (isBcryptHash(stored)) {
    const valid = await bcrypt.compare(input, stored);
    return { valid, needsRehash: false };
  }

  // Formato antigo (plaintext encriptado): comparação timing-safe
  const a = Buffer.from(input, "utf-8");
  const b = Buffer.from(stored, "utf-8");
  if (a.length !== b.length) {
    return { valid: false, needsRehash: false };
  }
  const valid = timingSafeEqual(a, b);
  return { valid, needsRehash: valid };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}
