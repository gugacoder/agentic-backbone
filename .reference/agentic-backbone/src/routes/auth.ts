import { Hono } from "hono";
import { sign } from "hono/jwt";
import mysql from "mysql2/promise";
import { authenticateUser } from "@cia-auth/core";
import type { UserRow, CiaAuthConfig } from "@cia-auth/core";
import { getUserWithPasswordHash, getUser } from "../users/manager.js";
import { verifyPassword } from "../users/password.js";

// Lazy MySQL pool — só criado se /auth/login/cia for chamado
let _ciaPrimePool: mysql.Pool | null = null;
function getCiaPrimePool(): mysql.Pool {
  if (!_ciaPrimePool) {
    _ciaPrimePool = mysql.createPool({
      host: process.env.MYSQL_CIA_PRIME_HOST,
      port: parseInt(process.env.MYSQL_CIA_PRIME_PORT ?? "3306"),
      user: process.env.MYSQL_CIA_PRIME_USER,
      password: process.env.MYSQL_CIA_PRIME_PASSWORD,
      database: process.env.MYSQL_CIA_PRIME_DATABASE,
    });
  }
  return _ciaPrimePool;
}

export const authPublicRoutes = new Hono();
export const authProtectedRoutes = new Hono();

// POST /auth/login/cia — autentica usuario Cia contra MySQL cia_prime (sem Laravel)
authPublicRoutes.post("/auth/login/cia", async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();

  if (!email || !password) {
    return c.json({ error: "email and password are required" }, 400);
  }

  const pool = getCiaPrimePool();

  const [userRows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT id, name, email, password, perfil AS role_id, tenant_id FROM users WHERE email = ? AND ativo = 1 LIMIT 1",
    [email],
  );

  if (!userRows.length) {
    return c.json({ error: "Credenciais inválidas" }, 401);
  }

  const userRow = userRows[0] as unknown as UserRow;

  const [unidadeRows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT tenant_id FROM unidades_users WHERE user_id = ?",
    [userRow.id],
  );

  const unidades = unidadeRows.map((r) => r.tenant_id as number);

  const authConfig: CiaAuthConfig = {
    secret: process.env.JWT_SECRET!,
    issuer: "ciacuidadores",
    accessTtlMinutes: Math.floor(parseInt(process.env.JWT_ACCESS_EXPIRATION ?? "86400") / 60),
    refreshTtlMinutes: Math.floor(parseInt(process.env.JWT_REFRESH_EXPIRATION ?? "604800") / 60),
  };

  const result = await authenticateUser(password, userRow, unidades, authConfig);
  if (!result) {
    return c.json({ error: "Credenciais inválidas" }, 401);
  }

  // Somente Administrador (perfil = 1) pode acessar o backbone via login Cia
  if (userRow.role_id !== 1) {
    return c.json({ error: "Acesso restrito a administradores" }, 403);
  }

  return c.json({ token: result.accessToken });
});

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
    tenant_id: 1,
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
    // Laravel JWT — return Cia user data derived from token claims
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

  // Backbone JWT — existing behavior
  const role = payload.role as "sysuser" | "user";

  if (role === "sysuser") {
    return c.json({
      user: payload.sub,
      role: "sysuser",
      displayName: payload.sub,
      jwtSource: "backbone",
    });
  }

  const userConfig = getUser(payload.sub);
  return c.json({
    user: payload.sub,
    role: "user",
    displayName: userConfig?.displayName ?? payload.sub,
    jwtSource: "backbone",
  });
});
