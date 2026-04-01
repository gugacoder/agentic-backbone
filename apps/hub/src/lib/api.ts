export { ApiError } from "./auth.js";
import { ApiError, useAuthStore } from "./auth.js";

const BASE_PATH = "/api/v1/ai";

export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers = new Headers(options?.headers);
  if (
    !headers.has("Content-Type") &&
    options?.body &&
    typeof options.body === "string"
  ) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BASE_PATH}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401) {
    useAuthStore.getState().logout();
    throw new ApiError(401, "unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? res.statusText, body.retryAfter);
  }

  return res.json() as Promise<T>;
}
