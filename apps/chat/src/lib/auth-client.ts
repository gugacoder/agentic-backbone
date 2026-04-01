import { useQuery } from "@tanstack/react-query"

export interface AuthUser {
  id: string
  role: string
  displayName: string
}

export interface IdentifyResult {
  method: "password" | "otp" | "choice"
  default?: "otp"
  phoneSuffix?: string
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
  ) {
    super(message)
  }
}

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api/v1/ai${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(res.status, (data as { error?: string }).error ?? "Erro desconhecido", (data as { retryAfter?: number }).retryAfter)
  }
  return res.json() as Promise<T>
}

export async function identify(username: string): Promise<IdentifyResult> {
  return apiPost("/auth/identify", { username })
}

export async function loginWithPassword(username: string, password: string): Promise<AuthUser> {
  const data = await apiPost<{ user: AuthUser }>("/auth/login", { username, password })
  return data.user
}

export async function loginWithOtp(username: string, code: string): Promise<AuthUser> {
  const data = await apiPost<{ user: AuthUser }>("/auth/otp-verify", { username, code })
  return data.user
}

export async function resendOtp(username: string): Promise<void> {
  await apiPost("/auth/otp-send", { username })
}

export async function logout(): Promise<void> {
  await fetch("/api/v1/ai/auth/logout", {
    method: "POST",
    credentials: "include",
  }).catch(() => {})
}

export async function getSession(): Promise<AuthUser | null> {
  const res = await fetch("/api/v1/ai/auth/me", { credentials: "include" })
  if (!res.ok) return null
  const me = (await res.json()) as { user: string; role: string; displayName: string }
  return { id: me.user, role: me.role, displayName: me.displayName }
}

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
