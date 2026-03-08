/**
 * MCP Server — Backbone as MCP server for external clients (Claude Desktop, Cursor, etc.)
 *
 * Endpoints:
 *   GET  /mcp/sse       — SSE stream (JWT via ?token= or Authorization header)
 *   POST /mcp/message   — JSON-RPC messages from client (requires ?sessionId=)
 *
 * Transport: implements the MCP SSE protocol manually using Hono streamSSE,
 * because the SDK's SSEServerTransport requires raw Node.js ServerResponse.
 *
 * Protocol flow:
 *   1. Client GETs /mcp/sse → server sends `endpoint` event with POST URL + sessionId
 *   2. Client POSTs JSON-RPC to /mcp/message?sessionId=<id>
 *   3. Server processes via McpServer and sends response back over SSE stream
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { randomUUID } from "node:crypto";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage, MessageExtraInfo } from "@modelcontextprotocol/sdk/types.js";
import { loadMcpServerConfig } from "../settings/mcp-server.js";
import { createBackboneMcpServer } from "./server.js";

// ---------------------------------------------------------------------------
// Custom Hono-compatible SSE transport
// ---------------------------------------------------------------------------

type WriteSSEFn = (event: { event?: string; data: string }) => Promise<void>;

interface Session {
  transport: HonoSSETransport;
  createdAt: number;
}

const sessions = new Map<string, Session>();

// Prune sessions older than 2h to prevent memory leaks
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      session.transport.close().catch(() => {});
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000).unref();

class HonoSSETransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void;
  sessionId: string;

  private _writeSSE: WriteSSEFn | null = null;
  private _pending: Array<{ event?: string; data: string }> = [];
  private _closed = false;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  async start(): Promise<void> {
    // No-op: stream is provided externally via setStream()
  }

  /** Called by the GET /mcp/sse handler once the SSE stream is ready */
  setStream(write: WriteSSEFn): void {
    this._writeSSE = write;
    // Flush any messages queued before the stream was ready
    for (const msg of this._pending) {
      write(msg).catch((err: unknown) => this.onerror?.(err instanceof Error ? err : new Error(String(err))));
    }
    this._pending = [];
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this._closed) return;
    const payload = { event: "message", data: JSON.stringify(message) };
    if (this._writeSSE) {
      await this._writeSSE(payload);
    } else {
      this._pending.push(payload);
    }
  }

  /** Called by POST /mcp/message to dispatch an incoming JSON-RPC message */
  receiveMessage(raw: unknown): void {
    if (this._closed) return;
    try {
      this.onmessage?.(raw as JSONRPCMessage);
    } catch (err) {
      this.onerror?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  async close(): Promise<void> {
    if (this._closed) return;
    this._closed = true;
    this._writeSSE = null;
    this.onclose?.();
  }
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function initMcpServerRoutes(routes: Hono): void {
  // ---------------------------------------------------------------------------
  // GET /mcp/sse — establish SSE connection
  // ---------------------------------------------------------------------------
  routes.get("/mcp/sse", async (c) => {
    const config = loadMcpServerConfig();

    if (!config.enabled) {
      return c.json({ error: "MCP Server está desabilitado" }, 503);
    }

    // Build the POST endpoint URL (preserve token for client's subsequent POSTs)
    const reqUrl = new URL(c.req.url);
    const sessionId = randomUUID();
    const postUrl = buildPostUrl(reqUrl, sessionId);

    const transport = new HonoSSETransport(sessionId);
    sessions.set(sessionId, { transport, createdAt: Date.now() });

    // Create a fresh McpServer per connection (stateless per session)
    const mcpServer = createBackboneMcpServer(config);

    try {
      await mcpServer.connect(transport);
    } catch (err) {
      sessions.delete(sessionId);
      return c.json({ error: "Falha ao iniciar MCP Server" }, 500);
    }

    return streamSSE(c, async (stream) => {
      // Wire the SSE write function into the transport
      transport.setStream(async (msg) => {
        await stream.writeSSE({ event: msg.event, data: msg.data });
      });

      // Send the `endpoint` event — tells the client where to POST messages
      await stream.writeSSE({
        event: "endpoint",
        data: postUrl,
      });

      stream.onAbort(() => {
        transport.close().catch(() => {});
        sessions.delete(sessionId);
        mcpServer.close().catch(() => {});
      });

      // Keep-alive loop
      while (!stream.closed) {
        await stream.sleep(30_000);
        if (!stream.closed) {
          await stream.writeSSE({ event: "ping", data: "" });
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // POST /mcp/message — receive JSON-RPC messages from client
  // ---------------------------------------------------------------------------
  routes.post("/mcp/message", async (c) => {
    const config = loadMcpServerConfig();

    if (!config.enabled) {
      return c.json({ error: "MCP Server está desabilitado" }, 503);
    }

    const sessionId = c.req.query("sessionId");
    if (!sessionId) {
      return c.json({ error: "sessionId é obrigatório" }, 400);
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return c.json({ error: "Sessão não encontrada ou expirada" }, 404);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Corpo da requisição inválido (JSON esperado)" }, 400);
    }

    session.transport.receiveMessage(body);
    return c.json({ ok: true });
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPostUrl(reqUrl: URL, sessionId: string): string {
  // Construct the POST URL:
  // - Same origin as the GET request
  // - /mcp/message path (relative to /api/v1/ai prefix)
  // - Preserve ?token= if present (so client can auth on POST too)
  const token = reqUrl.searchParams.get("token");
  let path = reqUrl.pathname.replace(/\/sse$/, "/message");
  path += `?sessionId=${encodeURIComponent(sessionId)}`;
  if (token) {
    path += `&token=${encodeURIComponent(token)}`;
  }
  return path;
}
