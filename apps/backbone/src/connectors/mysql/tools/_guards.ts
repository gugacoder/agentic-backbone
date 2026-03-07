const DDL_PATTERN =
  /^\s*(DROP|ALTER|TRUNCATE|CREATE|RENAME|GRANT|REVOKE)\b/i;

const DML_PATTERN =
  /^\s*(INSERT|UPDATE|DELETE|MERGE|REPLACE|LOAD)\b/i;

const READ_PATTERN =
  /^\s*(SELECT|SHOW|DESCRIBE|EXPLAIN)\b/i;

export function guardQuery(sql: string): string | null {
  if (DML_PATTERN.test(sql)) return "Operações de escrita não são permitidas em query. Use mutate.";
  if (DDL_PATTERN.test(sql)) return "Operações DDL não são permitidas em query.";
  return null;
}

export function guardMutate(sql: string, policy: string): string | null {
  if (DDL_PATTERN.test(sql)) return "Operações DDL não são permitidas.";
  if (READ_PATTERN.test(sql)) return "Use a tool de query para consultas.";
  if (policy === "readonly") return "Este adapter é readonly. Mutações não são permitidas.";
  return null;
}
