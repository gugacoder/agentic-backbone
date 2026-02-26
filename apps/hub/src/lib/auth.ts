import { create } from "zustand";

const TOKEN_KEY = "auth_token";

interface AuthState {
  token: string | null;
  user: string | null;
  role: "sysuser" | "user" | null;
  displayName: string | null;
  isAuthenticated: boolean;
  isSysuser: boolean;
  login: (token: string) => void;
  logout: () => void;
}

interface JwtClaims {
  sub: string;
  role?: "sysuser" | "user";
  role_id?: number;
  name?: string;
}

function decodeJwtPayload(token: string): JwtClaims {
  const base64 = token.split(".")[1];
  const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json);
}

function deriveAuthFromToken(token: string): {
  user: string;
  role: "sysuser" | "user";
  displayName: string | null;
} {
  const claims = decodeJwtPayload(token);

  if (claims.role_id !== undefined) {
    // JWT Laravel — role_id present
    return {
      user: claims.sub,
      role: claims.role_id === 1 ? "sysuser" : "user",
      displayName: claims.name ?? null,
    };
  }

  // JWT Backbone — role claim present
  return {
    user: claims.sub,
    role: claims.role ?? "user",
    displayName: null,
  };
}

function initFromStorage(): Omit<AuthState, "login" | "logout"> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    return { token: null, user: null, role: null, displayName: null, isAuthenticated: false, isSysuser: false };
  }
  try {
    const { user, role, displayName } = deriveAuthFromToken(token);
    return { token, user, role, displayName, isAuthenticated: true, isSysuser: role === "sysuser" };
  } catch {
    // Corrupted token — treat as unauthenticated
    localStorage.removeItem(TOKEN_KEY);
    return { token: null, user: null, role: null, displayName: null, isAuthenticated: false, isSysuser: false };
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...initFromStorage(),
  login: (token) => {
    localStorage.setItem(TOKEN_KEY, token);
    const { user, role, displayName } = deriveAuthFromToken(token);
    set({ token, user, role, displayName, isAuthenticated: true, isSysuser: role === "sysuser" });
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null, role: null, displayName: null, isAuthenticated: false, isSysuser: false });
  },
}));
