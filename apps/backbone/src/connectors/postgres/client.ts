import pg from "pg";

interface ParsedCredential {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

interface ParsedOptions {
  max: number;
}

export function createPostgresClient(credential: ParsedCredential, options: ParsedOptions) {
  const pool = new pg.Pool({
    host: credential.host,
    port: credential.port,
    database: credential.database,
    user: credential.user,
    password: credential.password,
    max: options.max,
  });

  return {
    async query(sql: string) {
      const result = await pool.query(sql);
      return result.rows;
    },
    async mutate(sql: string) {
      const result = await pool.query(sql);
      return { rowCount: result.rowCount, rows: result.rows };
    },
    async close() {
      await pool.end();
    },
  };
}
