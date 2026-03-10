import { Hono } from "hono";
import {
  listUsers,
  getUser,
  createUser,
  userExists,
  updateUser,
  deleteUser,
} from "../users/manager.js";
import { getAuthUser, requireSysuser } from "./auth-helpers.js";

export const userRoutes = new Hono();

// --- List Users (sysuser only) ---

userRoutes.get("/users", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;
  return c.json(listUsers());
});

// --- Get User (sysuser or self) ---

userRoutes.get("/users/:slug", (c) => {
  const auth = getAuthUser(c);
  const slug = c.req.param("slug");
  if (auth.role !== "sysuser" && slug !== auth.user) {
    return c.json({ error: "forbidden" }, 403);
  }
  const user = getUser(slug);
  if (!user) return c.json({ error: "not found" }, 404);
  return c.json(user);
});

// --- Create User (sysuser only) ---

userRoutes.post("/users", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const { slug, displayName, password, permissions } = await c.req.json<{
    slug: string;
    displayName: string;
    password: string;
    permissions?: {
      canCreateAgents?: boolean;
      canCreateChannels?: boolean;
      maxAgents?: number;
    };
  }>();

  if (!slug || !displayName || !password) {
    return c.json({ error: "slug, displayName, and password are required" }, 400);
  }
  if (userExists(slug)) {
    return c.json({ error: "user already exists" }, 409);
  }

  const user = createUser(slug, displayName, password, permissions);
  return c.json(user, 201);
});

// --- Update User (sysuser or self — limited) ---

userRoutes.patch("/users/:slug", async (c) => {
  const auth = getAuthUser(c);
  const slug = c.req.param("slug");

  if (auth.role !== "sysuser" && slug !== auth.user) {
    return c.json({ error: "forbidden" }, 403);
  }

  const body = await c.req.json<{
    displayName?: string;
    password?: string;
    permissions?: {
      canCreateAgents?: boolean;
      canCreateChannels?: boolean;
      maxAgents?: number;
    };
  }>();

  // Regular users can only update their own displayName
  if (auth.role !== "sysuser") {
    const updates: { displayName?: string } = {};
    if (body.displayName) updates.displayName = body.displayName;
    const updated = updateUser(slug, updates);
    if (!updated) return c.json({ error: "not found" }, 404);
    return c.json(updated);
  }

  const updated = updateUser(slug, body);
  if (!updated) return c.json({ error: "not found" }, 404);
  return c.json(updated);
});

// --- Delete User (sysuser only) ---

userRoutes.delete("/users/:slug", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;
  const slug = c.req.param("slug");
  if (slug === "system") {
    return c.json({ error: "cannot delete system user" }, 400);
  }
  const deleted = deleteUser(slug);
  if (!deleted) return c.json({ error: "not found" }, 404);
  return c.json({ status: "deleted" });
});
