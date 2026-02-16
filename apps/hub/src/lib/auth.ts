import { create } from "zustand";

interface AuthState {
  token: string | null;
  user: string | null;
  role: "sysuser" | "user" | null;
  displayName: string | null;
  isAuthenticated: boolean;
  isSysuser: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

function decodeJwtPayload(token: string): { sub: string; role: "sysuser" | "user" } {
  const base64 = token.split(".")[1];
  const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json);
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("hub-auth-token"),
  user: localStorage.getItem("hub-auth-user"),
  role: localStorage.getItem("hub-auth-role") as AuthState["role"],
  displayName: localStorage.getItem("hub-auth-displayName"),
  isAuthenticated: !!localStorage.getItem("hub-auth-token"),
  isSysuser: localStorage.getItem("hub-auth-role") === "sysuser",
  login: async (token) => {
    localStorage.setItem("hub-auth-token", token);
    const { sub, role } = decodeJwtPayload(token);
    localStorage.setItem("hub-auth-user", sub);
    localStorage.setItem("hub-auth-role", role);
    set({ token, user: sub, role, isAuthenticated: true, isSysuser: role === "sysuser" });

    // Fetch displayName from /auth/me
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("hub-auth-displayName", data.displayName);
        set({ displayName: data.displayName });
      }
    } catch {
      // displayName is non-critical
    }
  },
  logout: () => {
    localStorage.removeItem("hub-auth-token");
    localStorage.removeItem("hub-auth-user");
    localStorage.removeItem("hub-auth-role");
    localStorage.removeItem("hub-auth-displayName");
    set({ token: null, user: null, role: null, displayName: null, isAuthenticated: false, isSysuser: false });
  },
}));
