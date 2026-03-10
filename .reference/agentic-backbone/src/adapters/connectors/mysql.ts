import { createPool, type Pool } from "mysql2/promise";
import type { MysqlParams, MysqlConnector } from "./types.js";

export function createMysqlConnector(params: MysqlParams): MysqlConnector {
  let pool: Pool | null = null;

  function getPool(): Pool {
    if (!pool) {
      pool = createPool({
        host: params.host,
        port: params.port,
        database: params.database,
        user: params.user,
        password: params.password,
        waitForConnections: true,
        connectionLimit: 5,
        dateStrings: true,
      });
    }
    return pool;
  }

  async function query(sql: string, sqlParams?: unknown[]): Promise<unknown[]> {
    const [rows] = await getPool().query(sql, sqlParams);
    return rows as unknown[];
  }

  async function mutate(sql: string, sqlParams?: unknown[]): Promise<unknown> {
    const [result] = await getPool().query(sql, sqlParams);
    return result;
  }

  async function health(): Promise<string> {
    await getPool().query("SELECT 1");
    return "MySQL connection OK";
  }

  async function close(): Promise<void> {
    if (pool) {
      await pool.end();
      pool = null;
    }
  }

  return { query, mutate, health, close };
}
