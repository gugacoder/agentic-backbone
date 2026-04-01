import type { Context } from "hono";

export interface AuthUser {
  user: string;
  role: "sysuser" | "user";
  jwtSource: "laravel" | "backbone";
  allowedAgents?: string[];
  /** Laravel JWT only: user display name */
  name?: string;
  /** Laravel JWT only: tenant (unidade principal) */
  tenantId?: number;
  /** Laravel JWT only: array of unidade IDs */
  unidades?: number[];
  /** Laravel JWT only: original role_id from Laravel */
  roleId?: number;
}

export function getAuthUser(c: Context): AuthUser {
  const payload = c.get("jwtPayload");
  const base: AuthUser = {
    user: payload.sub,
    role: payload.role,
    jwtSource: payload.jwtSource ?? "backbone",
    allowedAgents: payload.allowedAgents,
  };

  if (payload.jwtSource === "laravel") {
    base.name = payload.name;
    base.roleId = payload.role_id;
    base.tenantId = payload.tenant_id;
    base.unidades = payload.unidades;
  }

  return base;
}

export function assertAgentAccess(c: Context, agentId: string): Response | null {
  const auth = getAuthUser(c);
  if (!auth.allowedAgents) return null;
  if (auth.allowedAgents.includes(agentId)) return null;
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
    return c.json({ error: "forbidden" }, 403);
  }
  return null;
}
