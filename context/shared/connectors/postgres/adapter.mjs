// ══════════════════════════════════════════════════════════════════
// PostgreSQL Connector — Factory Node.js
//
// Uso:
//   import { createAdapter } from '../../connectors/postgres/adapter.mjs';
//   const { query, mutate, close } = createAdapter(adapterDir);
//
// Lê params de ADAPTER.yaml no adapterDir.
// Retorna { query, mutate, close } com pool lazy.
// ══════════════════════════════════════════════════════════════════

import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const { Pool } = pg;

function readAdapterParams(adapterDir) {
  const content = readFileSync(resolve(adapterDir, 'ADAPTER.yaml'), 'utf-8');
  const params = {};
  let inParams = false;
  for (const line of content.split('\n')) {
    if (line.trimEnd() === 'params:') { inParams = true; continue; }
    if (inParams) {
      if (line.length > 0 && !line.startsWith(' ') && !line.startsWith('\t')) break;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;
      params[trimmed.slice(0, colonIdx).trim()] = trimmed.slice(colonIdx + 1).trim();
    }
  }
  return params;
}

export function createAdapter(adapterDir) {
  let pool;

  function getPool() {
    if (!pool) {
      const p = readAdapterParams(adapterDir);
      for (const key of ['host', 'port', 'database', 'user', 'password']) {
        if (!p[key]) {
          throw new Error(`Param "${key}" ausente no ADAPTER.yaml de ${adapterDir}`);
        }
      }
      pool = new Pool({
        host: p.host,
        port: Number(p.port),
        database: p.database,
        user: p.user,
        password: p.password,
        max: 5,
      });
    }
    return pool;
  }

  async function query(sql, params) {
    const result = await getPool().query(sql, params);
    return result.rows;
  }

  async function mutate(sql, params) {
    const result = await getPool().query(sql, params);
    return { rowCount: result.rowCount, command: result.command };
  }

  async function close() {
    if (pool) {
      await pool.end();
      pool = null;
    }
  }

  return { query, mutate, close };
}
