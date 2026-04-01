import { Hono } from "hono";
import { sign } from "hono/jwt";
import { getUser, getUserByEmail, getUserCredential, getUserByIdentifier, updateUserCredentialPassword } from "../users/manager.js";
import { verifyPassword, hashPassword } from "../users/password.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { sendOtp, verifyOtp } from "../otp/sender.js";
import { isOtpEnabled } from "../settings/otp.js";

// Shared helper: generate JWT for authenticated user
async function createAuthToken(slug: string, configRole: string): Promise<string> {
  const role: "sysuser" | "user" = configRole === "sysadmin" ? "sysuser" : "user";
  const now = Math.floor(Date.now() / 1000);
  return sign({ sub: slug, role, iat: now, exp: now + 60 * 60 * 24 }, process.env.JWT_SECRET!);
}

export const authPublicRoutes = new Hono();
export const authProtectedRoutes = new Hono();

// POST /auth/login — public (rate limited)
authPublicRoutes.post("/auth/login", rateLimit(), async (c) => {
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
  const { valid, needsRehash } = await verifyPassword(password, record.password);
  if (!valid) {
    return c.json({ error: "invalid credentials" }, 401);
  }
  if (needsRehash) {
    const hashed = await hashPassword(password);
    updateUserCredentialPassword(record.slug, hashed);
  }

  const token = await createAuthToken(record.slug, record.config.role ?? "user");
  return c.json({ token });
});

// POST /auth/identify — public (step 1 of login wizard, rate limited)
authPublicRoutes.post("/auth/identify", rateLimit(), async (c) => {
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
  }

  // Auto-send OTP for method === 'otp' when OTP is globally enabled
  if (method === "otp" && isOtpEnabled()) {
    try {
      await sendOtp(resolved.slug, config.phoneNumber!);
    } catch {
      // Fallback: if send fails and user has password, downgrade to password auth
      if (hasPassword) {
        method = "password";
        phoneSuffix = undefined;
      }
      // If no password fallback, continue with otp method (client can use /auth/otp-send to retry)
    }
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

// POST /auth/otp-send — public (rate limited) — resend OTP code
authPublicRoutes.post("/auth/otp-send", rateLimit(), async (c) => {
  const body = await c.req.json<{ username?: string }>().catch(() => ({ username: undefined }));
  const { username } = body;

  const GENERIC_401 = "Credenciais inválidas";

  if (!username) {
    return c.json({ error: GENERIC_401 }, 401);
  }

  // Anti-enumeration: same 401 for inexistent user or user without OTP
  if (!isOtpEnabled()) {
    return c.json({ error: GENERIC_401 }, 401);
  }

  const resolved = getUserByIdentifier(username);
  if (!resolved) {
    return c.json({ error: GENERIC_401 }, 401);
  }

  const { config } = resolved;
  const hasOtp = config.auth?.otp === true && !!config.phoneNumber;
  if (!hasOtp) {
    return c.json({ error: GENERIC_401 }, 401);
  }

  try {
    await sendOtp(resolved.slug, config.phoneNumber!);
  } catch {
    return c.json({ error: "Falha ao enviar código. Tente novamente." }, 500);
  }

  return c.json({ success: true });
});

// POST /auth/otp-verify — public (rate limited)
authPublicRoutes.post("/auth/otp-verify", rateLimit(), async (c) => {
  const body = await c.req.json<{ username?: string; code?: string }>().catch(() => ({ username: undefined, code: undefined }));
  const { username, code } = body;

  if (!username || !code || !/^\d{6}$/.test(code)) {
    return c.json({ error: "Código inválido" }, 400);
  }

  const resolved = getUserByIdentifier(username);
  if (!resolved) {
    return c.json({ error: "Credenciais inválidas" }, 401);
  }

  const valid = verifyOtp(resolved.slug, code);
  if (!valid) {
    return c.json({ error: "Código inválido ou expirado" }, 401);
  }

  const token = await createAuthToken(resolved.slug, resolved.config.role ?? "user");
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
