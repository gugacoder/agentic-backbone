import { api } from "@/lib/api";

export async function login(credentials: {
  username: string;
  password: string;
}): Promise<{ token: string }> {
  // Direct fetch — bypass api wrapper to avoid 401 interceptor on login
  const res = await fetch("/api/v2/agents/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(body.error ?? "Login failed");
  }

  return body;
}

export async function loginLaravel(credentials: {
  email: string;
  password: string;
}): Promise<{ token: string }> {
  const res = await fetch("/api/v2/agents/auth/login/cia", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(body.message ?? body.error ?? "Credenciais inválidas");
  }

  return { token: body.token };
}

export interface MeResponse {
  user: string;
  role: "sysuser" | "user";
  displayName: string;
}

export function getMe() {
  return api.get<MeResponse>("/auth/me");
}
