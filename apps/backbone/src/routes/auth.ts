import { Hono } from "hono";
import { sign } from "hono/jwt";
import { getUser, getUserByEmail, getUserCredential } from "../users/manager.js";
import { verifyPassword } from "../users/password.js";

export const authPublicRoutes = new Hono();
export const authProtectedRoutes = new Hono();

// POST /auth/login — public
authPublicRoutes.post("/auth/login", async (c) => {
  const { username, password } = await c.req.json<{
    username: string;
    password: string;
  }>();

  if (!username || !password) {
    return c.json({ error: "username and password are required" }, 400);
  }

  let record = getUserByEmail(username);
  if (!record) {
    const bySlug = getUserCredential(username);
    if (bySlug) record = { slug: username, ...bySlug };
  }
  if (!record) {
    return c.json({ error: "invalid credentials" }, 401);
  }
  if (!verifyPassword(password, record.password)) {
    return c.json({ error: "invalid credentials" }, 401);
  }

  const role: "sysuser" | "user" = record.config.role === "sysadmin" ? "sysuser" : "user";
  const sub = record.slug;

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub,
    role,
    iat: now,
    exp: now + 60 * 60 * 24, // 24h
  };

  const token = await sign(payload, process.env.JWT_SECRET!);
  return c.json({ token });
});

// GET /auth/me — protected (mounted after JWT middleware)
// Returns user data appropriate to JWT type (Laravel vs Backbone)
authProtectedRoutes.get("/auth/me", (c) => {
  const payload = c.get("jwtPayload");

  if (payload.jwtSource === "laravel") {
    return c.json({
      user: payload.sub,
      role: payload.role,
      displayName: payload.name ?? payload.sub,
      jwtSource: "laravel",
      roleId: payload.role_id,
      tenantId: payload.tenant_id,
      unidades: payload.unidades,
    });
  }

  const userConfig = getUser(payload.sub);
  return c.json({
    user: payload.sub,
    role: payload.role,
    displayName: userConfig?.displayName ?? payload.sub,
    jwtSource: "backbone",
  });
});
