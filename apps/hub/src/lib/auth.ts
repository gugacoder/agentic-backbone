import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  role: string;
  displayName: string;
}

export type AuthMethod = "password" | "otp" | "choice";

export interface IdentifyResult {
  method: AuthMethod;
  default?: "otp";
  phoneSuffix?: string;
}

export class ApiError extends Error {
  public body: unknown;
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
    this.body = { error: message };
  }
}

interface AuthState {
  user: AuthUser | null;
  identify: (username: string) => Promise<IdentifyResult>;
  loginWithPassword: (username: string, password: string) => Promise<void>;
  loginWithOtp: (username: string, code: string) => Promise<void>;
  resendOtp: (username: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,

      identify: async (username) => {
        const res = await fetch("/api/v1/ai/auth/identify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
          credentials: "include",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new ApiError(res.status, body.error ?? "Erro desconhecido", body.retryAfter);
        }
        return res.json() as Promise<IdentifyResult>;
      },

      loginWithPassword: async (username, password) => {
        const res = await fetch("/api/v1/ai/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
          credentials: "include",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new ApiError(res.status, body.error ?? "Erro desconhecido", body.retryAfter);
        }
        const { user } = await res.json();
        set({ user });
      },

      loginWithOtp: async (username, code) => {
        const res = await fetch("/api/v1/ai/auth/otp-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, code }),
          credentials: "include",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new ApiError(res.status, body.error ?? "Erro desconhecido", body.retryAfter);
        }
        const { user } = await res.json();
        set({ user });
      },

      resendOtp: async (username) => {
        const res = await fetch("/api/v1/ai/auth/otp-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
          credentials: "include",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new ApiError(res.status, body.error ?? "Erro desconhecido", body.retryAfter);
        }
      },

      logout: async () => {
        await fetch("/api/v1/ai/auth/logout", {
          method: "POST",
          credentials: "include",
        }).catch(() => {});
        set({ user: null });
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      },

      checkAuth: async () => {
        const res = await fetch("/api/v1/ai/auth/me", {
          credentials: "include",
        });
        if (res.ok) {
          const me = await res.json();
          set({ user: { id: me.user, role: me.role, displayName: me.displayName } });
          return true;
        }
        set({ user: null });
        return false;
      },
    }),
    {
      name: "ab-hub-auth",
      partialize: (state) => ({ user: state.user }), // SEM token
    },
  ),
);
