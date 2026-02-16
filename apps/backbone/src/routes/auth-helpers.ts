import type { Context } from "hono";

export interface AuthUser {
  user: string;
  role: "sysuser" | "user";
}

export function getAuthUser(c: Context): AuthUser {
  const payload = c.get("jwtPayload");
  return { user: payload.sub, role: payload.role };
}

export function requireSysuser(c: Context): Response | null {
  const auth = getAuthUser(c);
  if (auth.role !== "sysuser") {
    return c.json({ error: "forbidden" }, 403);
  }
  return null;
}

export function filterByOwner<T extends { owner: string }>(
  items: T[],
  auth: AuthUser
): T[] {
  if (auth.role === "sysuser") return items;
  return items.filter((item) => item.owner === auth.user);
}

export function assertOwnership(
  c: Context,
  ownerId: string
): Response | null {
  const auth = getAuthUser(c);
  if (auth.role === "sysuser") return null;
  if (ownerId !== auth.user) {
    return c.json({ error: "forbidden" }, 403);
  }
  return null;
}
