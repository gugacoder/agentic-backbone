import { Hono } from "hono";
import { sign } from "hono/jwt";
import { getUserWithPasswordHash, getUser } from "../users/manager.js";
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

  let role: "sysuser" | "user";

  if (username === process.env.SYSUSER) {
    // Sysuser login — validate against env var
    if (password !== process.env.SYSPASS) {
      return c.json({ error: "invalid credentials" }, 401);
    }
    role = "sysuser";
  } else {
    // Regular user login — validate against filesystem
    const record = getUserWithPasswordHash(username);
    if (!record) {
      return c.json({ error: "invalid credentials" }, 401);
    }
    if (!verifyPassword(password, record.passwordHash)) {
      return c.json({ error: "invalid credentials" }, 401);
    }
    role = "user";
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: username,
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
  const role = payload.role as "sysuser" | "user";

  if (role === "sysuser") {
    return c.json({
      user: payload.sub,
      role: "sysuser",
      displayName: payload.sub,
    });
  }

  const userConfig = getUser(payload.sub);
  return c.json({
    user: payload.sub,
    role: "user",
    displayName: userConfig?.displayName ?? payload.sub,
  });
});
