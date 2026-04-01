import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { randomUUID } from "node:crypto";
import type { McpCredential, McpOptions } from "./schemas.js";
import { formatError } from "../../utils/errors.js";
import { db } from "../../db/index.js";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type McpNotificationHandler = (
  slug: string,
  method: string,
  params: Record<string, unknown>
) => void;

interface CachedEntry {
  client: Client;
  tools: McpToolDefinition[];
  options: McpOptions;
  credential: McpCredential;
}

// ---------------------------------------------------------------------------
// McpClientPool — singleton per process
// Manages persistent connections to MCP servers, keyed by adapter slug.
// ---------------------------------------------------------------------------

class McpClientPool {
  private cache = new Map<string, CachedEntry>();
  private notificationHandlers: McpNotificationHandler[] = [];

  // --- Notification subscription ---

  onNotification(handler: McpNotificationHandler): () => void {
    this.notificationHandlers.push(handler);
    return () => {
      const idx = this.notificationHandlers.indexOf(handler);
      if (idx >= 0) this.notificationHandlers.splice(idx, 1);
    };
  }

  private emitNotification(
    slug: string,
    method: string,
    params: Record<string, unknown>
  ): void {
    for (const handler of this.notificationHandlers) {
      try {
        handler(slug, method, params);
      } catch (err) {
        console.warn(`[mcp] notification handler error:`, err);
      }
    }
  }

  // --- Connection management ---

  async connect(
    slug: string,
    credential: McpCredential,
    options: McpOptions
  ): Promise<void> {
    if (this.cache.has(slug)) return; // already connected

    let transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport;

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
    } else if (options.transport === "streamable-http") {
      if (!options.url) {
        throw new Error(
          `MCP adapter "${slug}": url is required for streamable-http transport`
        );
      }
      const headers: Record<string, string> = {};
      if (credential.api_key) {
        headers["Authorization"] = `Bearer ${credential.api_key}`;
      }
      transport = new StreamableHTTPClientTransport(
        new URL(options.url),
        { requestInit: { headers } }
      );
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

    // Debug: log transport SSE events
    transport.onerror = (err) => console.warn(`[mcp] transport error for "${slug}":`, err.message);
    transport.onclose = () => console.log(`[mcp] transport closed for "${slug}"`);

    try {
      await client.connect(transport);
      console.log(`[mcp] connected to "${slug}", sessionId: ${(transport as any).sessionId ?? "none"}`);
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

      // Subscribe to server notifications and forward to handlers
      client.fallbackNotificationHandler = async (notification) => {
        this.emitNotification(
          slug,
          notification.method,
          (notification.params ?? {}) as Record<string, unknown>
        );
      };

      this.cache.set(slug, { client, tools, options, credential });
      console.log(
        `[mcp] connected to "${slug}" (${options.server_label}) — ${tools.length} tool(s) available`
      );

      // For streamable-http: open a SEPARATE MCP session dedicated to SSE listening.
      // The SDK's internal SSE doesn't reliably deliver notifications in Node.js.
      if (options.transport === "streamable-http" && options.url) {
        this.openDedicatedSseSession(slug, options.url, credential);
      }
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

  // --- Dedicated SSE session for streamable-http notifications ---

  private sseAbortControllers = new Map<string, AbortController>();

  private async openDedicatedSseSession(
    slug: string,
    url: string,
    credential: McpCredential
  ): Promise<void> {
    console.log(`[mcp] opening dedicated SSE session for "${slug}" at ${url}`);
    const controller = new AbortController();
    this.sseAbortControllers.set(slug, controller);

    const authHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (credential.api_key) {
      authHeaders["Authorization"] = `Bearer ${credential.api_key}`;
    }

    try {
      // Step 1: Create a new MCP session via initialize
      const initResponse = await fetch(url, {
        method: "POST",
        headers: { ...authHeaders, "Accept": "application/json, text/event-stream" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "backbone-sse-listener", version: "1.0.0" },
          },
        }),
        signal: controller.signal,
      });

      const sessionId = initResponse.headers.get("mcp-session-id");
      if (!sessionId) {
        console.warn(`[mcp] SSE session for "${slug}": no session ID returned`);
        return;
      }

      // Cancel the init response body (it's an SSE stream that never ends)
      await initResponse.body?.cancel();

      // Step 2: Send notifications/initialized to trigger SSE
      const notifResponse = await fetch(url, {
        method: "POST",
        headers: { ...authHeaders, "Mcp-Session-Id": sessionId },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
        }),
        signal: controller.signal,
      });
      await notifResponse.body?.cancel();

      // Step 3: Open GET SSE on this new session
      const sseResponse = await fetch(url, {
        method: "GET",
        headers: {
          ...(credential.api_key ? { "Authorization": `Bearer ${credential.api_key}` } : {}),
          "Accept": "text/event-stream",
          "Mcp-Session-Id": sessionId,
        },
        signal: controller.signal,
      });

      if (!sseResponse.ok || !sseResponse.body) {
        console.warn(`[mcp] SSE stream for "${slug}" failed: ${sseResponse.status}`);
        return;
      }

      console.log(`[mcp] SSE listener opened for "${slug}" (dedicated session=${sessionId})`);

      // Step 4: Parse SSE events
      const reader = sseResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const readLoop = async () => {
        try {
          let chunkCount = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) { console.log(`[mcp] SSE stream ended for "${slug}"`); break; }

            chunkCount++;
            const decoded = decoder.decode(value, { stream: true });
            buffer += decoded;

            // Log first few chunks and any notification
            if (chunkCount <= 3 || decoded.includes("notifications/")) {
              console.log(`[mcp] SSE chunk #${chunkCount} for "${slug}": ${decoded.slice(0, 120)}...`);
            }

            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const msg = JSON.parse(line.slice(6));
                  if (msg.method) {
                    console.log(`[mcp] SSE notification: ${msg.method}`);
                    this.emitNotification(slug, msg.method, msg.params ?? {});
                  }
                } catch {
                  // Not valid JSON — skip
                }
              }
            }
          }
        } catch (err: any) {
          if (err?.name !== "AbortError") {
            console.warn(`[mcp] SSE stream error for "${slug}":`, err?.message);
            // Reconnect after 5s
            if (this.cache.has(slug) && !controller.signal.aborted) {
              setTimeout(() => this.openDedicatedSseSession(slug, url, credential), 5_000);
            }
          }
        }
      };

      readLoop();
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error(`[mcp] SSE session setup failed for "${slug}":`, err?.message);
      }
    }
  }

  ensureSseListener(slug: string): void {
    const entry = this.cache.get(slug);
    if (!entry || entry.options.transport !== "streamable-http" || !entry.options.url) return;
    if (this.sseAbortControllers.has(slug)) {
      // Already has a controller — check if it's aborted
      const existing = this.sseAbortControllers.get(slug)!;
      if (!existing.signal.aborted) return; // still active
    }
    console.log(`[mcp] re-opening SSE listener for "${slug}"`);
    this.openDedicatedSseSession(slug, entry.options.url, entry.credential);
  }

  private closeSseListener(slug: string): void {
    const controller = this.sseAbortControllers.get(slug);
    if (controller) {
      controller.abort();
      this.sseAbortControllers.delete(slug);
    }
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
      const errMsg = formatError(err);
      // Auto-reconnect on session expiry
      if (errMsg.includes("Session not found") || errMsg.includes("session")) {
        console.log(`[mcp] session expired for "${slug}" — reconnecting...`);
        try {
          await this.reconnect(slug);
          const retryResult = await this.cache.get(slug)!.client.callTool({
            name: toolName,
            arguments: args as Record<string, unknown>,
          });
          output = retryResult;
          return retryResult;
        } catch (retryErr) {
          error = formatError(retryErr);
          throw retryErr;
        }
      }
      error = errMsg;
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

  private async reconnect(slug: string): Promise<void> {
    const entry = this.cache.get(slug);
    if (!entry) return;
    const { credential, options } = entry;
    try { await entry.client.close(); } catch { /* ignore */ }
    this.cache.delete(slug);
    await this.connect(slug, credential, options);
    console.log(`[mcp] reconnected to "${slug}"`);
  }

  // --- Lifecycle ---

  async disconnect(slug: string): Promise<void> {
    this.closeSseListener(slug);
    const entry = this.cache.get(slug);
    if (!entry) return;
    try {
      await entry.client.close();
      console.log(`[mcp] disconnected from "${slug}"`);
    } catch (err) {
      console.warn(`[mcp] error closing "${slug}": ${formatError(err)}`);
    }
    this.cache.delete(slug);
  }

  async closeAll(): Promise<void> {
    for (const slug of this.sseAbortControllers.keys()) {
      this.closeSseListener(slug);
    }
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
