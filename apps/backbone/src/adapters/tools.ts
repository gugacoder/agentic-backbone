import { tool } from "ai";
import { z } from "zod";
import { resolveAdapters } from "../context/resolver.js";
import { loadAdapter } from "./loader.js";

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

// --- Factory ---

export function createAdapterTools(agentId: string): Record<string, any> | null {
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

  const tools: Record<string, any> = {};

  // --- MySQL tools ---
  const mysqlAdapters = groups.get("mysql");
  if (mysqlAdapters && mysqlAdapters.length > 0) {
    const slugs = mysqlAdapters.map((a) => a.slug) as [string, ...string[]];
    const policyMap = new Map(mysqlAdapters.map((a) => [a.slug, a.policy]));

    tools.mysql_query = tool({
      description: "Execute a read-only SQL query on a MySQL database. Returns rows as JSON.",
      parameters: z.object({
        database: z.enum(slugs).describe("Adapter/database slug"),
        sql: z.string().describe("SQL SELECT query"),
      }),
      execute: async (args) => {
        const rejection = guardQuery(args.sql);
        if (rejection) return { error: rejection };
        try {
          const instance = await loadAdapter(args.database);
          return await instance.query(args.sql);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    });

    tools.mysql_mutate = tool({
      description: "Execute a DML mutation (INSERT, UPDATE, DELETE) on a MySQL database. Returns affected rows info.",
      parameters: z.object({
        database: z.enum(slugs).describe("Adapter/database slug"),
        sql: z.string().describe("SQL DML statement"),
      }),
      execute: async (args) => {
        const policy = policyMap.get(args.database) ?? "readonly";
        const rejection = guardMutate(args.sql, policy);
        if (rejection) return { error: rejection };
        try {
          const instance = await loadAdapter(args.database);
          return await instance.mutate(args.sql);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    });
  }

  // --- PostgreSQL tools ---
  const pgAdapters = groups.get("postgres");
  if (pgAdapters && pgAdapters.length > 0) {
    const slugs = pgAdapters.map((a) => a.slug) as [string, ...string[]];
    const policyMap = new Map(pgAdapters.map((a) => [a.slug, a.policy]));

    tools.postgres_query = tool({
      description: "Execute a read-only SQL query on a PostgreSQL database. Returns rows as JSON.",
      parameters: z.object({
        database: z.enum(slugs).describe("Adapter/database slug"),
        sql: z.string().describe("SQL SELECT query"),
      }),
      execute: async (args) => {
        const rejection = guardQuery(args.sql);
        if (rejection) return { error: rejection };
        try {
          const instance = await loadAdapter(args.database);
          return await instance.query(args.sql);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    });

    tools.postgres_mutate = tool({
      description: "Execute a DML mutation (INSERT, UPDATE, DELETE) on a PostgreSQL database. Returns affected rows info.",
      parameters: z.object({
        database: z.enum(slugs).describe("Adapter/database slug"),
        sql: z.string().describe("SQL DML statement"),
      }),
      execute: async (args) => {
        const policy = policyMap.get(args.database) ?? "readonly";
        const rejection = guardMutate(args.sql, policy);
        if (rejection) return { error: rejection };
        try {
          const instance = await loadAdapter(args.database);
          return await instance.mutate(args.sql);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    });
  }

  // --- Evolution API tools ---
  const evoAdapters = groups.get("evolution");
  if (evoAdapters && evoAdapters.length > 0) {
    const slugs = evoAdapters.map((a) => a.slug) as [string, ...string[]];

    tools.evolution_api = tool({
      description: "Call the Evolution API (WhatsApp gateway). Supports GET and POST methods.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Evolution adapter slug"),
        method: z.enum(["GET", "POST"]).describe("HTTP method"),
        endpoint: z.string().describe("API endpoint path (e.g. /message/sendText/instance)"),
        body: z.string().optional().describe("JSON body for POST requests"),
      }),
      execute: async (args) => {
        try {
          const adapter = await loadAdapter(args.instance);
          let result: unknown;
          if (args.method === "GET") {
            result = await adapter.get(args.endpoint);
          } else {
            const body = args.body ? JSON.parse(args.body) : undefined;
            result = await adapter.send(args.endpoint, body);
          }
          return result;
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    });
  }

  if (Object.keys(tools).length === 0) return null;

  return tools;
}
