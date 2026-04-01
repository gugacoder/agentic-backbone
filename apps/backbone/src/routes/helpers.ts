import type { Context } from "hono";

export async function parseBody<T = Record<string, unknown>>(c: Context): Promise<T | Response> {
  try {
    return await c.req.json<T>();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
}
