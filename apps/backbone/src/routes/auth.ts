import { Hono } from "hono";
import { sign } from "hono/jwt";
import { getUser, getUserByEmail, getUserCredential, getUserByIdentifier } from "../users/manager.js";
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

// POST /auth/identify — public (step 1 of login wizard)
authPublicRoutes.post("/auth/identify", async (c) => {
  const body = await c.req.json<{ username?: string }>().catch(() => ({ username: undefined }));
  const { username } = body;

  if (!username) {
    return c.json({ error: "Credenciais inválidas" }, 401);
  }

  const resolved = getUserByIdentifier(username);

  if (!resolved) {
    return c.json({ error: "Credenciais inválidas" }, 401);
  }

  const { config } = resolved;

  if (!config.auth?.otp && !config.auth?.password) {
    return c.json({ error: "Credenciais inválidas" }, 401);
  }

  const hasOtp = config.auth.otp === true && !!config.phoneNumber;
  const hasPassword = config.auth.password === true;

  let method: "otp" | "password" | "choice";
  let phoneSuffix: string | undefined;

  if (hasOtp && hasPassword) {
    method = "choice";
  } else if (hasOtp) {
    method = "otp";
  } else {
    method = "password";
  }

  if (method === "otp" || method === "choice") {
    phoneSuffix = config.phoneNumber!.slice(-2);
    // TODO: integrate sendOtp() when PRP-24B is implemented
  }

  const response: Record<string, unknown> = { method };
  if (method === "choice") {
    response.default = "otp";
  }
  if (phoneSuffix !== undefined) {
    response.phoneSuffix = phoneSuffix;
  }

  return c.json(response);
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
