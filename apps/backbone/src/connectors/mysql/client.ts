import mysql from "mysql2/promise";
import type { z } from "zod";
import type { AdapterInstance } from "../types.js";
import type { credentialSchema, optionsSchema } from "./schemas.js";

type Credential = z.infer<typeof credentialSchema>;
type Options = z.infer<typeof optionsSchema>;

export function createMysqlClient(credential: Credential, options: Options): AdapterInstance {
  const pool = mysql.createPool({
    host: credential.host,
    port: credential.port,
    database: credential.database,
    user: credential.user,
    password: credential.password,
    connectionLimit: options.connectionLimit,
  });

  return {
    async query(sql: unknown) {
      const [rows] = await pool.query(String(sql));
      return rows;
    },

    async mutate(sql: unknown) {
      const [result] = await pool.query(String(sql));
      const r = result as mysql.ResultSetHeader;
      return {
        affectedRows: r.affectedRows,
        insertId: r.insertId,
        changedRows: r.changedRows,
      };
    },

    async close() {
      await pool.end();
    },
  } as AdapterInstance;
}
