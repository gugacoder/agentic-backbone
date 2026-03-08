import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { randomUUID } from "node:crypto";
import type { McpCredential, McpOptions } from "./schemas.js";
import { formatError } from "../../utils/errors.js";
import { db } from "../../db/index.js";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface CachedEntry {
  client: Client;
  tools: McpToolDefinition[];
  options: McpOptions;
}

// ---------------------------------------------------------------------------
// McpClientPool — singleton per process
// Manages persistent connections to MCP servers, keyed by adapter slug.
// ---------------------------------------------------------------------------

class McpClientPool {
  private cache = new Map<string, CachedEntry>();

  // --- Connection management ---

  async connect(
    slug: string,
    credential: McpCredential,
    options: McpOptions
  ): Promise<void> {
    if (this.cache.has(slug)) return; // already connected

    let transport: StdioClientTransport | SSEClientTransport;

    if (options.transport === "stdio") {
      if (!options.command) {
        throw new Error(
          `MCP adapter "${slug}": command is required for stdio transport`
        );
      }
      transport = new StdioClientTransport({
        command: options.command,
        args: options.args,
        env: {
          ...(process.env as Record<string, string>),
          ...options.env,
        },
        stderr: "pipe",
      });
    } else {
      if (!options.url) {
        throw new Error(
          `MCP adapter "${slug}": url is required for http transport`
        );
      }
      const sseOpts: ConstructorParameters<typeof SSEClientTransport>[1] = {};
      if (credential.api_key) {
        const authHeader = `Bearer ${credential.api_key}`;
        sseOpts.requestInit = {
          headers: { Authorization: authHeader },
        };
        // eventSourceInit accepts headers via the eventsource package — cast to any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sseOpts.eventSourceInit = {
          headers: { Authorization: authHeader },
        } as any;
      }
      transport = new SSEClientTransport(new URL(options.url), sseOpts);
    }

    const client = new Client(
      { name: "agentic-backbone", version: "1.0.0" },
      { capabilities: {} }
    );

    try {
      await client.connect(transport);
      const result = await client.listTools();

      let tools: McpToolDefinition[] = result.tools.map((t) => ({
        name: t.name,
        description: t.description ?? "",
        inputSchema: (t.inputSchema as Record<string, unknown>) ?? {
          type: "object",
          properties: {},
        },
      }));

      // Filter by allowed_tools if configured
      if (options.allowed_tools.length > 0) {
        const allowed = new Set(options.allowed_tools);
        tools = tools.filter((t) => allowed.has(t.name));
      }

      this.cache.set(slug, { client, tools, options });
      console.log(
        `[mcp] connected to "${slug}" (${options.server_label}) — ${tools.length} tool(s) available`
      );
    } catch (err) {
      console.error(
        `[mcp] failed to connect to "${slug}": ${formatError(err)}`
      );
      try {
        await client.close();
      } catch {
        // ignore close errors during failed connect
      }
      throw err;
    }
  }

  // --- Tool access ---

  getCachedTools(slug: string): McpToolDefinition[] {
    return this.cache.get(slug)?.tools ?? [];
  }

  getAllConnected(): {
    slug: string;
    label: string;
    tools: McpToolDefinition[];
  }[] {
    return [...this.cache.entries()].map(([slug, entry]) => ({
      slug,
      label: entry.options.server_label,
      tools: entry.tools,
    }));
  }

  isConnected(slug: string): boolean {
    return this.cache.has(slug);
  }

  // --- Tool execution + audit ---

  async callTool(
    slug: string,
    toolName: string,
    args: unknown,
    agentId: string
  ): Promise<unknown> {
    const entry = this.cache.get(slug);
    if (!entry) {
      throw new Error(`MCP adapter "${slug}" not connected`);
    }

    const startMs = Date.now();
    let output: unknown = undefined;
    let error: string | undefined;

    try {
      const result = await entry.client.callTool({
        name: toolName,
        arguments: args as Record<string, unknown>,
      });
      output = result;
      return result;
    } catch (err) {
      error = formatError(err);
      throw err;
    } finally {
      const durationMs = Date.now() - startMs;
      recordMcpToolCall({
        agentId,
        adapterId: slug,
        toolName,
        input: args,
        output,
        error,
        durationMs,
      });
    }
  }

  // --- Lifecycle ---

  async closeAll(): Promise<void> {
    for (const [slug, entry] of this.cache) {
      try {
        await entry.client.close();
        console.log(`[mcp] disconnected from "${slug}"`);
      } catch (err) {
        console.warn(`[mcp] error closing "${slug}": ${formatError(err)}`);
      }
    }
    this.cache.clear();
  }
}

export const mcpClientPool = new McpClientPool();

// ---------------------------------------------------------------------------
// DB audit helper
// ---------------------------------------------------------------------------

function recordMcpToolCall(params: {
  agentId: string;
  adapterId: string;
  toolName: string;
  input: unknown;
  output?: unknown;
  error?: string;
  durationMs: number;
}): void {
  try {
    db.prepare(
      `INSERT INTO mcp_tool_calls (id, agent_id, adapter_id, tool_name, input, output, error, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      params.agentId,
      params.adapterId,
      params.toolName,
      JSON.stringify(params.input ?? null),
      params.output !== undefined ? JSON.stringify(params.output) : null,
      params.error ?? null,
      params.durationMs
    );
  } catch (err) {
    console.warn("[mcp] failed to record tool call:", err);
  }
}
