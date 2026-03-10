export function normalizeSlug(val: unknown): unknown {
  if (typeof val !== "string") return val;
  const kebab = val.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  return kebab.replace(/_/g, "-");
}
