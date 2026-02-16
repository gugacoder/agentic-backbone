import { api } from "@/lib/api";

export async function login(credentials: {
  username: string;
  password: string;
}): Promise<{ token: string }> {
  // Direct fetch — bypass api wrapper to avoid 401 interceptor on login
  const res = await fetch("/api/auth/login", {
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

export interface MeResponse {
  user: string;
  role: "sysuser" | "user";
  displayName: string;
}

export function getMe() {
  return api.get<MeResponse>("/auth/me");
}
