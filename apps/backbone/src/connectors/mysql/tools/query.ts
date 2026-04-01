import { tool } from "ai";
import { z } from "zod";
import { guardQuery } from "./_guards.js";
import { formatError } from "../../../utils/errors.js";

export function createMysqlQueryTool(slugs: [string, ...string[]]): Record<string, any> {
  return {
    mysql_query: tool({
      description: "Execute a read-only SQL query on a MySQL database. Returns rows as JSON.",
      parameters: z.object({
        database: z.enum(slugs).describe("Adapter/database slug"),
        sql: z.string().describe("SQL SELECT query"),
      }),
      execute: async (args) => {
        const rejection = guardQuery(args.sql);
        if (rejection) return { error: rejection };
        try {
          const { connectorRegistry } = await import("../../index.js");
          const instance = connectorRegistry.createClient(args.database);
          return await instance.query(args.sql);
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
