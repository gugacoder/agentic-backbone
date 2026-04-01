import { timingSafeEqual } from "node:crypto";

/** Minimum 12 chars, at least one letter and one digit. */
const MIN_LENGTH = 12;
const HAS_LETTER = /[a-zA-Z]/;
const HAS_DIGIT = /\d/;

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < MIN_LENGTH) return `senha deve ter no minimo ${MIN_LENGTH} caracteres`;
  if (!HAS_LETTER.test(password)) return "senha deve conter pelo menos uma letra";
  if (!HAS_DIGIT.test(password)) return "senha deve conter pelo menos um digito";
  return null;
}

export function verifyPassword(input: string, stored: string): boolean {
  const a = Buffer.from(input, "utf-8");
  const b = Buffer.from(stored, "utf-8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
