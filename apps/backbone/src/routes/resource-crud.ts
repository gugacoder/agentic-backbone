import { Hono } from "hono";
import { formatError } from "../utils/errors.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface ResourceCrudOps {
  list: (agentId: string) => any[];
  listGlobal: () => any[];
  create: (body: any) => any;
  update: (scope: string, slug: string, body: any) => any;
  delete: (scope: string, slug: string) => boolean;
  assign?: (sourceScope: string, slug: string, agentId: string) => any;
}

export function createResourceCrudRoutes(
  name: string,
  ops: ResourceCrudOps
): Hono {
  const app = new Hono();

  // List
  app.get(`/${name}`, (c) => {
    const agentId = c.req.query("agentId");
    if (agentId) {
      return c.json(ops.list(agentId));
    }
    return c.json(ops.listGlobal());
  });

  // Create
  app.post(`/${name}`, async (c) => {
    const body = await c.req.json();
    try {
      const resource = ops.create(body);
      return c.json(resource, 201);
    } catch (err) {
      return c.json({ error: formatError(err) }, 400);
    }
  });

  // Update
  app.patch(`/${name}/:scope/:slug`, async (c) => {
    const scope = c.req.param("scope");
    const slug = c.req.param("slug");
    const body = await c.req.json();
    try {
      const resource = ops.update(scope, slug, body);
      return c.json(resource);
    } catch (err) {
      return c.json({ error: formatError(err) }, 500);
    }
  });

  // Delete
  app.delete(`/${name}/:scope/:slug`, (c) => {
    const scope = c.req.param("scope");
    const slug = c.req.param("slug");
    const deleted = ops.delete(scope, slug);
    if (!deleted) return c.json({ error: "not found" }, 404);
    return c.json({ status: "deleted" });
  });

  // Assign to agent
  if (ops.assign) {
    const assignFn = ops.assign;
    app.post(`/${name}/assign`, async (c) => {
      const { sourceScope, slug, agentId } = await c.req.json<{
        sourceScope: string;
        slug: string;
        agentId: string;
      }>();
      try {
        const resource = assignFn(sourceScope, slug, agentId);
        return c.json(resource, 201);
      } catch (err) {
        return c.json({ error: formatError(err) }, 400);
      }
    });
  }

  return app;
}
