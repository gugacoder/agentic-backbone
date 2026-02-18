import { createSdkMcpServer, tool as sdkTool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { resolveAdapters } from "../context/resolver.js";
import { loadAdapter, type AdapterInstance } from "./loader.js";

// Workaround: SDK expects zod v4 types but backbone uses zod v3.
// Both are structurally compatible at runtime. This wrapper bridges the type gap.
const tool = sdkTool as (
  name: string,
  description: string,
  inputSchema: Record<string, any>,
  handler: (args: any, extra: unknown) => Promise<any>,
  extras?: any,
) => ReturnType<typeof sdkTool>;

// --- SQL Guards ---

const DDL_PATTERN =
  /^\s*(DROP|ALTER|TRUNCATE|CREATE|RENAME|GRANT|REVOKE)\b/i;

const DML_PATTERN =
  /^\s*(INSERT|UPDATE|DELETE|MERGE|REPLACE|LOAD)\b/i;

const READ_PATTERN =
  /^\s*(SELECT|SHOW|DESCRIBE|EXPLAIN)\b/i;

function guardQuery(sql: string): string | null {
  if (DML_PATTERN.test(sql)) return "Operações de escrita não são permitidas em query. Use mutate.";
  if (DDL_PATTERN.test(sql)) return "Operações DDL não são permitidas em query.";
  return null;
}

function guardMutate(sql: string, policy: string): string | null {
  if (DDL_PATTERN.test(sql)) return "Operações DDL não são permitidas.";
  if (READ_PATTERN.test(sql)) return "Use a tool de query para consultas.";
  if (policy === "readonly") return "Este adapter é readonly. Mutações não são permitidas.";
  return null;
}

// --- Tool result helpers ---

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function errorResult(msg: string) {
  return textResult(`Error: ${msg}`);
}

// --- Factory ---

export function createAdapterMcpServer(agentId: string) {
  const adapters = resolveAdapters(agentId);
  if (adapters.size === 0) return null;

  // Group adapters by connector type
  const groups = new Map<string, { slug: string; policy: string }[]>();
  for (const [slug, a] of adapters) {
    const connector = (a.metadata.connector as string) ?? "";
    if (!connector) continue;
    let group = groups.get(connector);
    if (!group) {
      group = [];
      groups.set(connector, group);
    }
    group.push({
      slug,
      policy: (a.metadata.policy as string) ?? "readonly",
    });
  }

  const tools: Parameters<typeof createSdkMcpServer>[0]["tools"] = [];

  // --- MySQL tools ---
  const mysqlAdapters = groups.get("mysql");
  if (mysqlAdapters && mysqlAdapters.length > 0) {
    const slugs = mysqlAdapters.map((a) => a.slug) as [string, ...string[]];
    const policyMap = new Map(mysqlAdapters.map((a) => [a.slug, a.policy]));

    tools.push(
      tool(
        "mysql_query",
        "Execute a read-only SQL query on a MySQL database. Returns rows as JSON.",
        {
          database: z.enum(slugs).describe("Adapter/database slug"),
          sql: z.string().describe("SQL SELECT query"),
        },
        async (args) => {
          const rejection = guardQuery(args.sql);
          if (rejection) return errorResult(rejection);
          try {
            const instance = await loadAdapter(args.database);
            const rows = await instance.query(args.sql);
            return textResult(JSON.stringify(rows));
          } catch (err) {
            return errorResult(err instanceof Error ? err.message : String(err));
          }
        }
      )
    );

    tools.push(
      tool(
        "mysql_mutate",
        "Execute a DML mutation (INSERT, UPDATE, DELETE) on a MySQL database. Returns affected rows info.",
        {
          database: z.enum(slugs).describe("Adapter/database slug"),
          sql: z.string().describe("SQL DML statement"),
        },
        async (args) => {
          const policy = policyMap.get(args.database) ?? "readonly";
          const rejection = guardMutate(args.sql, policy);
          if (rejection) return errorResult(rejection);
          try {
            const instance = await loadAdapter(args.database);
            const result = await instance.mutate(args.sql);
            return textResult(JSON.stringify(result));
          } catch (err) {
            return errorResult(err instanceof Error ? err.message : String(err));
          }
        }
      )
    );
  }

  // --- PostgreSQL tools ---
  const pgAdapters = groups.get("postgres");
  if (pgAdapters && pgAdapters.length > 0) {
    const slugs = pgAdapters.map((a) => a.slug) as [string, ...string[]];
    const policyMap = new Map(pgAdapters.map((a) => [a.slug, a.policy]));

    tools.push(
      tool(
        "postgres_query",
        "Execute a read-only SQL query on a PostgreSQL database. Returns rows as JSON.",
        {
          database: z.enum(slugs).describe("Adapter/database slug"),
          sql: z.string().describe("SQL SELECT query"),
        },
        async (args) => {
          const rejection = guardQuery(args.sql);
          if (rejection) return errorResult(rejection);
          try {
            const instance = await loadAdapter(args.database);
            const rows = await instance.query(args.sql);
            return textResult(JSON.stringify(rows));
          } catch (err) {
            return errorResult(err instanceof Error ? err.message : String(err));
          }
        }
      )
    );

    tools.push(
      tool(
        "postgres_mutate",
        "Execute a DML mutation (INSERT, UPDATE, DELETE) on a PostgreSQL database. Returns affected rows info.",
        {
          database: z.enum(slugs).describe("Adapter/database slug"),
          sql: z.string().describe("SQL DML statement"),
        },
        async (args) => {
          const policy = policyMap.get(args.database) ?? "readonly";
          const rejection = guardMutate(args.sql, policy);
          if (rejection) return errorResult(rejection);
          try {
            const instance = await loadAdapter(args.database);
            const result = await instance.mutate(args.sql);
            return textResult(JSON.stringify(result));
          } catch (err) {
            return errorResult(err instanceof Error ? err.message : String(err));
          }
        }
      )
    );
  }

  // --- Evolution API tools ---
  const evoAdapters = groups.get("evolution");
  if (evoAdapters && evoAdapters.length > 0) {
    const slugs = evoAdapters.map((a) => a.slug) as [string, ...string[]];

    tools.push(
      tool(
        "evolution_api",
        "Call the Evolution API (WhatsApp gateway). Supports GET and POST methods.",
        {
          instance: z.enum(slugs).describe("Evolution adapter slug"),
          method: z.enum(["GET", "POST"]).describe("HTTP method"),
          endpoint: z.string().describe("API endpoint path (e.g. /message/sendText/instance)"),
          body: z.string().optional().describe("JSON body for POST requests"),
        },
        async (args) => {
          try {
            const adapter = await loadAdapter(args.instance);
            let result: unknown;
            if (args.method === "GET") {
              result = await adapter.get(args.endpoint);
            } else {
              const body = args.body ? JSON.parse(args.body) : undefined;
              result = await adapter.send(args.endpoint, body);
            }
            return textResult(JSON.stringify(result));
          } catch (err) {
            return errorResult(err instanceof Error ? err.message : String(err));
          }
        }
      )
    );
  }

  if (tools.length === 0) return null;

  return createSdkMcpServer({
    name: "backbone-adapters",
    version: "1.0.0",
    tools,
  });
}
