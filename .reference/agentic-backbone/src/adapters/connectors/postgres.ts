import pg from "pg";
import type { PostgresParams, PostgresConnector } from "./types.js";

const { Pool } = pg;

export function createPostgresConnector(params: PostgresParams): PostgresConnector {
  let pool: InstanceType<typeof Pool> | null = null;

  function getPool(): InstanceType<typeof Pool> {
    if (!pool) {
      pool = new Pool({
        host: params.host,
        port: params.port,
        database: params.database,
        user: params.user,
        password: params.password,
        max: 5,
      });
    }
    return pool;
  }

  async function query(sql: string, sqlParams?: unknown[]): Promise<unknown[]> {
    const result = await getPool().query(sql, sqlParams);
    return result.rows;
  }

  async function mutate(sql: string, sqlParams?: unknown[]): Promise<{ rowCount: number | null; command: string }> {
    const result = await getPool().query(sql, sqlParams);
    return { rowCount: result.rowCount, command: result.command };
  }

  async function health(): Promise<string> {
    await getPool().query("SELECT 1");
    return "PostgreSQL connection OK";
  }

  async function close(): Promise<void> {
    if (pool) {
      await pool.end();
      pool = null;
    }
  }

  return { query, mutate, health, close };
}
