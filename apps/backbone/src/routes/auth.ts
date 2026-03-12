import { Hono } from "hono";
import { sign } from "hono/jwt";
import { getUser, getUserByEmail } from "../users/manager.js";
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

  const record = getUserByEmail(username);
  if (!record) {
    return c.json({ error: "invalid credentials" }, 401);
  }
  if (!verifyPassword(password, record.passwordHash)) {
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
authProtectedRoutes.get("/auth/me", (c) => {
  const payload = c.get("jwtPayload");
  const userConfig = getUser(payload.sub);
  return c.json({
    user: payload.sub,
    role: payload.role,
    displayName: userConfig?.displayName ?? payload.sub,
  });
});
