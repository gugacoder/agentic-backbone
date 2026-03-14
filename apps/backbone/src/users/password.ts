import { timingSafeEqual } from "node:crypto";

export function verifyPassword(input: string, stored: string): boolean {
  const a = Buffer.from(input, "utf-8");
  const b = Buffer.from(stored, "utf-8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
