import { Hono } from "hono";
import {
  listUsers,
  getUser,
  createUser,
  userExists,
  updateUser,
  deleteUser,
} from "../users/manager.js";
import { listAgents } from "../agents/registry.js";
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

  const { slug, displayName, password, email, phoneNumber, permissions, address } = await c.req.json<{
    slug: string;
    displayName: string;
    password: string;
    email?: string;
    phoneNumber?: string;
    permissions?: {
      canCreateAgents?: boolean;
      canCreateChannels?: boolean;
      maxAgents?: number;
    };
    address?: {
      street?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
      timezone?: string;
    };
  }>();

  if (!slug || !displayName || !password) {
    return c.json({ error: "slug, displayName, and password are required" }, 400);
  }
  if (userExists(slug)) {
    return c.json({ error: "user already exists" }, 409);
  }

  const user = await createUser(slug, displayName, password, permissions, email, phoneNumber, address);
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
    email?: string;
    phoneNumber?: string;
    password?: string;
    role?: string | null;
    address?: {
      street?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
      timezone?: string;
    };
    permissions?: {
      canCreateAgents?: boolean;
      canCreateChannels?: boolean;
      maxAgents?: number;
    };
  }>();

  // Regular users can update their own displayName, email, password, and address
  if (auth.role !== "sysuser") {
    const updates: { displayName?: string; email?: string; phoneNumber?: string; password?: string; address?: typeof body.address } = {};
    if (body.displayName) updates.displayName = body.displayName;
    if (body.email !== undefined) updates.email = body.email;
    if (body.phoneNumber !== undefined) updates.phoneNumber = body.phoneNumber;
    if (body.password) updates.password = body.password;
    if (body.address !== undefined) updates.address = body.address;
    const updated = await updateUser(slug, updates);
    if (!updated) return c.json({ error: "not found" }, 404);
    return c.json(updated);
  }

  const updated = await updateUser(slug, body);
  if (!updated) return c.json({ error: "not found" }, 404);
  return c.json(updated);
});

// --- User Agents (sysuser only) ---

userRoutes.get("/users/:slug/agents", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;
  const slug = c.req.param("slug");
  const user = getUser(slug);
  if (!user) return c.json({ error: "not found" }, 404);
  const agents = listAgents().filter((a) => a.owner === slug);
  return c.json(
    agents.map((a) => ({
      id: a.id,
      slug: a.slug,
      enabled: a.enabled,
      description: a.description?.slice(0, 100) || "",
    })),
  );
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
