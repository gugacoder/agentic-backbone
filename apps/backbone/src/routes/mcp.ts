import { Hono } from "hono";
import { db } from "../db/index.js";
import { connectorRegistry } from "../connectors/index.js";
import { mcpClientPool } from "../connectors/mcp/index.js";
import { credentialSchema, optionsSchema } from "../connectors/mcp/schemas.js";

export const mcpRoutes = new Hono();

// ---------------------------------------------------------------------------
// GET /agents/:id/mcp-tools
// Lists all MCP tools available for a given agent (from connected adapters).
// ---------------------------------------------------------------------------

mcpRoutes.get("/agents/:id/mcp-tools", (c) => {
  const agentId = c.req.param("id");

  // Resolve MCP adapters for this agent
  const adapters = connectorRegistry.resolveAdapters(agentId);
  const mcpAdapters = [...adapters.values()].filter(
    (a) => a.connector === "mcp"
  );

  const servers = mcpAdapters.map((adapter) => {
    const optsResult = optionsSchema.safeParse(adapter.options);
    const serverLabel = optsResult.success
      ? optsResult.data.server_label
      : adapter.slug;

    const tools = mcpClientPool.getCachedTools(adapter.slug);
    const connected = mcpClientPool.isConnected(adapter.slug);

    return {
      adapterSlug: adapter.slug,
      serverLabel,
      transport: optsResult.success ? optsResult.data.transport : "unknown",
      connected,
      tools: tools.map((t) => ({
        name: t.name,
        prefixedName: `mcp_${adapter.slug.replace(/[^a-zA-Z0-9]/g, "_")}_${t.name.replace(/[^a-zA-Z0-9]/g, "_")}`,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  });

  const totalTools = servers.reduce((sum, s) => sum + s.tools.length, 0);

  return c.json({
    agentId,
    servers,
    totalTools,
  });
});

// ---------------------------------------------------------------------------
// GET /agents/:id/mcp-calls
// Paginated history of MCP tool calls for a given agent.
// Query params: limit (default 50), offset (default 0), adapter (optional)
// ---------------------------------------------------------------------------

mcpRoutes.get("/agents/:id/mcp-calls", (c) => {
  const agentId = c.req.param("id");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 200);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);
  const adapter = c.req.query("adapter");

  type McpCallRow = {
    id: string;
    agent_id: string;
    adapter_id: string;
    tool_name: string;
    input: string;
    output: string | null;
    error: string | null;
    duration_ms: number | null;
    called_at: string;
  };

  let rows: McpCallRow[];
  let total: { count: number };

  if (adapter) {
    rows = db
      .prepare(
        `SELECT id, agent_id, adapter_id, tool_name, input, output, error, duration_ms, called_at
         FROM mcp_tool_calls
         WHERE agent_id = ? AND adapter_id = ?
         ORDER BY called_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(agentId, adapter, limit, offset) as McpCallRow[];

    total = db
      .prepare(
        `SELECT COUNT(*) as count FROM mcp_tool_calls WHERE agent_id = ? AND adapter_id = ?`
      )
      .get(agentId, adapter) as { count: number };
  } else {
    rows = db
      .prepare(
        `SELECT id, agent_id, adapter_id, tool_name, input, output, error, duration_ms, called_at
         FROM mcp_tool_calls
         WHERE agent_id = ?
         ORDER BY called_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(agentId, limit, offset) as McpCallRow[];

    total = db
      .prepare(
        `SELECT COUNT(*) as count FROM mcp_tool_calls WHERE agent_id = ?`
      )
      .get(agentId) as { count: number };
  }

  const calls = rows.map((row) => ({
    id: row.id,
    agentId: row.agent_id,
    adapterId: row.adapter_id,
    toolName: row.tool_name,
    input: safeParseJson(row.input),
    output: row.output ? safeParseJson(row.output) : null,
    error: row.error,
    durationMs: row.duration_ms,
    calledAt: row.called_at,
  }));

  return c.json({
    agentId,
    calls,
    total: total.count,
    limit,
    offset,
  });
});

// ---------------------------------------------------------------------------
// POST /agents/:id/mcp-connect
// On-demand connect to a specific MCP adapter (for newly added adapters).
// ---------------------------------------------------------------------------

mcpRoutes.post("/agents/:id/mcp-connect", async (c) => {
  const agentId = c.req.param("id");
  const body = await c.req.json<{ adapterSlug: string }>();
  const { adapterSlug } = body;

  if (!adapterSlug) {
    return c.json({ error: "adapterSlug is required" }, 400);
  }

  // Find the adapter in agent scope
  const adapters = connectorRegistry.resolveAdapters(agentId);
  const adapter = adapters.get(adapterSlug);

  if (!adapter || adapter.connector !== "mcp") {
    return c.json({ error: `MCP adapter "${adapterSlug}" not found` }, 404);
  }

  const credResult = credentialSchema.safeParse(adapter.credential);
  const optsResult = optionsSchema.safeParse(adapter.options);

  if (!credResult.success || !optsResult.success) {
    return c.json({ error: "Invalid adapter config" }, 422);
  }

  try {
    await mcpClientPool.connect(adapterSlug, credResult.data, optsResult.data);
    const tools = mcpClientPool.getCachedTools(adapterSlug);
    return c.json({ ok: true, adapterSlug, tools });
  } catch (err) {
    return c.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// POST /adapters/:slug/mcp-test
// Test MCP connection for an adapter and return available tools.
// Does not require an agent context — uses the adapter directly.
// ---------------------------------------------------------------------------

mcpRoutes.post("/adapters/:slug/mcp-test", async (c) => {
  const slug = c.req.param("slug");

  const adapter = connectorRegistry.findAdapter(slug);
  if (!adapter || adapter.connector !== "mcp") {
    return c.json({ ok: false, error: `MCP adapter "${slug}" not found` }, 404);
  }

  const credResult = credentialSchema.safeParse(adapter.credential);
  const optsResult = optionsSchema.safeParse(adapter.options);

  if (!credResult.success || !optsResult.success) {
    return c.json({ ok: false, error: "Invalid adapter config" }, 422);
  }

  try {
    await mcpClientPool.connect(slug, credResult.data, optsResult.data);
    const tools = mcpClientPool.getCachedTools(slug);
    return c.json({
      ok: true,
      adapterSlug: slug,
      serverLabel: optsResult.data.server_label,
      tools: tools.map((t) => ({ name: t.name, description: t.description })),
    });
  } catch (err) {
    return c.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeParseJson(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
