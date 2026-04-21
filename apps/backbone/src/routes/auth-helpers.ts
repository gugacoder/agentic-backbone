import type { Context } from "hono";

export interface AuthUser {
  user: string;
  role: "sysuser" | "user";
  allowedAgents?: string[];
}

export function getAuthUser(c: Context): AuthUser {
  const payload = c.get("jwtPayload");
  return {
    user: payload.sub,
    role: payload.role,
    allowedAgents: payload.allowedAgents,
  };
}

export function assertAgentAccess(c: Context, agentId: string): Response | null {
  const auth = getAuthUser(c);
  if (!auth.allowedAgents) return null;
  if (auth.allowedAgents.includes(agentId)) return null;
  console.warn(`[DEBUG forbidden] assertAgentAccess FAIL url=${c.req.url} agentId=${agentId} allowed=${JSON.stringify(auth.allowedAgents)} user=${auth.user}`);
  return c.json({ error: "forbidden" }, 403);
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
    console.warn(`[DEBUG forbidden] assertOwnership FAIL url=${c.req.url} ownerId=${ownerId} authUser=${auth.user} role=${auth.role}`);
    return c.json({ error: "forbidden" }, 403);
  }
  return null;
}
