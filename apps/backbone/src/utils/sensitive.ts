const SENSITIVE_PATTERN = /key|secret|token|password|pass/i;

export function isSensitiveField(fieldName: string): boolean {
  return SENSITIVE_PATTERN.test(fieldName);
}

export function maskSensitiveFields(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    masked[k] = isSensitiveField(k) ? "***" : v;
  }
  return masked;
}

export function warnPlainTextSecrets(
  fields: Record<string, unknown>,
  context: string
): void {
  for (const [k, v] of Object.entries(fields)) {
    if (!isSensitiveField(k)) continue;
    if (typeof v === "string" && v !== "" && !/^\$\{.+\}$/.test(v)) {
      console.warn(
        `[${context}] field "${k}" written as plain text — use \${VAR} referencing .env`
      );
    }
  }
}
