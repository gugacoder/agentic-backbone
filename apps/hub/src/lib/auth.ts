import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,

      login: async (username, password) => {
        const res = await fetch("/api/v1/ai/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Erro desconhecido" }));
          throw new Error(body.error ?? "Erro desconhecido");
        }

        const { token } = (await res.json()) as { token: string };
        set({ token });
      },

      logout: () => {
        set({ token: null });
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      },
    }),
    {
      name: "ab-hub-auth",
      partialize: (state) => ({ token: state.token }),
    },
  ),
);
