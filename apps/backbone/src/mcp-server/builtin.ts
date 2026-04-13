/**
 * Builtin MCP Server (stdio transport)
 *
 * Exposes backbone internal tools to agents via MCP.
 * Spawned by the CLI as a child process. Communicates with backbone via HTTP.
 *
 * Environment:
 *   BACKBONE_URL   — Base URL (e.g., http://localhost:6002/api/v1/ai)
 *   BACKBONE_TOKEN — JWT for auth
 *   AGENT_ID       — Current agent ID
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BACKBONE_URL = process.env.BACKBONE_URL!;
const BACKBONE_TOKEN = process.env.BACKBONE_TOKEN!;
const AGENT_ID = process.env.AGENT_ID!;

if (!BACKBONE_URL || !BACKBONE_TOKEN || !AGENT_ID) {
  console.error("[builtin-mcp] Missing required env: BACKBONE_URL, BACKBONE_TOKEN, AGENT_ID");
  process.exit(1);
}

// --- HTTP helper ---

async function api(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = `${BACKBONE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${BACKBONE_TOKEN}`,
      "Content-Type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

function text(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
  };
}

function error(msg: string): { content: Array<{ type: "text"; text: string }>; isError: true } {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }],
    isError: true,
  };
}

// --- Server ---

const server = new McpServer({ name: "backbone-builtin", version: "1.0.0" });

// ── Job Tools ────────────────────────────────────────────────

server.tool(
  "backbone_submit_job",
  "Submit a shell command for backbone supervision. background=true returns immediately; yieldMs=0 blocks until exit; default auto-backgrounds after 10s.",
  {
    command: z.string().describe("Shell command to execute"),
    timeout: z.number().optional().describe("Timeout in seconds (default: 1800)"),
    background: z.boolean().optional().describe("If true, return immediately with jobId"),
    yieldMs: z.number().optional().describe("Auto-background after N ms. 0 = foreground. Default: 10000"),
    wakeMode: z.enum(["heartbeat", "conversation"]).optional().describe("How to wake agent when job finishes"),
    wakeContext: z.string().optional().describe("Context to include when waking"),
  },
  async (args) => {
    try {
      const result = await api("POST", "/jobs", {
        command: args.command,
        agentId: AGENT_ID,
        timeout: args.timeout,
        background: args.background,
        yieldMs: args.yieldMs,
        wakeMode: args.wakeMode,
        wakeContext: args.wakeContext,
      });
      return text(result);
    } catch (err) {
      return error((err as Error).message);
    }
  }
);

server.tool(
  "backbone_list_jobs",
  "List all jobs for this agent.",
  {},
  async () => {
    try {
      const result = await api("GET", `/jobs?agentId=${AGENT_ID}`);
      return text(result);
    } catch (err) {
      return error((err as Error).message);
    }
  }
);

server.tool(
  "backbone_get_job",
  "Get full details of a specific job including output tail, status, exit code, and duration.",
  {
    jobId: z.string().describe("Job ID to query"),
  },
  async ({ jobId }) => {
    try {
      const result = await api("GET", `/jobs/${jobId}`);
      return text(result);
    } catch (err) {
      return error((err as Error).message);
    }
  }
);

server.tool(
  "backbone_kill_job",
  "Kill a running job.",
  {
    jobId: z.string().describe("Job ID to kill"),
  },
  async ({ jobId }) => {
    try {
      const result = await api("POST", `/jobs/${jobId}/kill`);
      return text(result);
    } catch (err) {
      return error((err as Error).message);
    }
  }
);

// ── Memory Tools ─────────────────────────────────────────────

server.tool(
  "backbone_memory_search",
  "Search the agent's memory and knowledge base using hybrid vector + keyword search.",
  {
    query: z.string().describe("Natural language search query"),
    maxResults: z.number().optional().describe("Maximum results (default: 6)"),
  },
  async ({ query, maxResults }) => {
    try {
      const result = await api("POST", `/agents/${AGENT_ID}/memory/search`, {
        query,
        maxResults: maxResults ?? 6,
      });
      return text(result);
    } catch (err) {
      return error((err as Error).message);
    }
  }
);

server.tool(
  "backbone_memory_save",
  "Save important facts to the agent's long-term memory. Duplicates are skipped automatically.",
  {
    facts: z.array(z.string()).min(1).describe("Facts to save"),
  },
  async ({ facts }) => {
    try {
      const result = await api("POST", `/agents/${AGENT_ID}/memory/save`, { facts });
      return text(result);
    } catch (err) {
      return error((err as Error).message);
    }
  }
);

// ── Cron Tools ───────────────────────────────────────────────

server.tool(
  "backbone_cron_list",
  "List scheduled cron jobs for this agent.",
  {
    includeDisabled: z.boolean().optional().describe("Include disabled jobs (default: false)"),
  },
  async ({ includeDisabled }) => {
    try {
      const qs = includeDisabled ? "?includeDisabled=true" : "";
      const result = await api("GET", `/cron/jobs?agentId=${AGENT_ID}${qs}`);
      return text(result);
    } catch (err) {
      return error((err as Error).message);
    }
  }
);

server.tool(
  "backbone_cron_create",
  "Create a new scheduled cron job. kind='at' for one-shot, 'every' for interval, 'cron' for cron expressions.",
  {
    slug: z.string().describe("Unique slug for this job"),
    name: z.string().describe("Human-readable job name"),
    schedule: z.object({
      kind: z.enum(["at", "every", "cron"]),
      at: z.string().optional().describe("ISO-8601 datetime for one-shot"),
      everyMs: z.number().optional().describe("Interval in ms"),
      expr: z.string().optional().describe("Cron expression"),
      tz: z.string().optional().describe("IANA timezone"),
    }),
    payload: z.object({
      kind: z.enum(["heartbeat", "conversation", "request"]),
      message: z.string().optional(),
    }),
    deleteAfterRun: z.boolean().optional(),
    description: z.string().optional(),
  },
  async (args) => {
    try {
      const result = await api("POST", "/cron/jobs", {
        agentId: AGENT_ID,
        slug: args.slug,
        name: args.name,
        schedule: args.schedule,
        payload: args.payload,
        deleteAfterRun: args.deleteAfterRun,
        description: args.description,
      });
      return text(result);
    } catch (err) {
      return error((err as Error).message);
    }
  }
);

server.tool(
  "backbone_cron_delete",
  "Delete a scheduled cron job permanently.",
  {
    slug: z.string().describe("Slug of the job to delete"),
  },
  async ({ slug }) => {
    try {
      const result = await api("DELETE", `/cron/jobs/${AGENT_ID}/${slug}`);
      return text(result);
    } catch (err) {
      return error((err as Error).message);
    }
  }
);

// ── Message Tools ────────────────────────────────────────────

server.tool(
  "backbone_send_message",
  "Send a message to a channel.",
  {
    channel: z.string().describe("Channel slug"),
    message: z.string().describe("Message content"),
  },
  async ({ channel, message }) => {
    try {
      const result = await api("POST", `/channels/${channel}/deliver`, {
        agentId: AGENT_ID,
        message,
      });
      return text(result);
    } catch (err) {
      return error((err as Error).message);
    }
  }
);

// ── System Tools ─────────────────────────────────────────────

server.tool(
  "backbone_emit_event",
  "Emit a message to a channel by ID.",
  {
    channel: z.string().describe("Channel ID"),
    content: z.string().describe("Message content"),
  },
  async ({ channel, content }) => {
    try {
      const result = await api("POST", `/channels/${channel}/deliver`, {
        agentId: AGENT_ID,
        message: content,
      });
      return text(result);
    } catch (err) {
      return error((err as Error).message);
    }
  }
);

server.tool(
  "backbone_sysinfo",
  "Get system information: OS, CPU, memory, uptime, disk usage.",
  {},
  async () => {
    try {
      const result = await api("GET", "/system/sysinfo");
      return text(result);
    } catch (err) {
      return error((err as Error).message);
    }
  }
);

// --- Start ---

const transport = new StdioServerTransport();
await server.connect(transport);
