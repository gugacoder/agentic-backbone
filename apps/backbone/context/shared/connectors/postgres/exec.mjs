#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════
// PostgreSQL Connector — Executor SQL via pg
//
// Interface:
//   node exec.mjs <adapter-dir> <query|mutate> "<sql>"
//
// Exemplos:
//   node exec.mjs ../../adapters/my-db query "SELECT 1 AS test"
//   node exec.mjs ../../adapters/my-db mutate "INSERT INTO ..."
//
// Lê params de ADAPTER.yaml no adapter-dir.
// ══════════════════════════════════════════════════════════════════

import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const { Client } = pg;

// ── Args ──────────────────────────────────────────────────────────

const [adapterDir, mode, sql] = process.argv.slice(2);

if (!adapterDir || !mode || !sql) {
  console.error('Uso: node exec.mjs <adapter-dir> <query|mutate> "<sql>"');
  process.exit(1);
}

if (mode !== 'query' && mode !== 'mutate') {
  console.error(`Erro: modo inválido "${mode}". Use "query" ou "mutate".`);
  process.exit(1);
}

// ── ADAPTER.yaml reader ──────────────────────────────────────────

function readAdapterParams(dir) {
  const content = readFileSync(resolve(dir, 'ADAPTER.yaml'), 'utf-8');
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

// ── Formatação tabela ASCII (estilo psql) ─────────────────────────

function formatTable(rows, fields) {
  if (!rows.length) {
    console.log('(0 rows)');
    return;
  }

  const columns = fields.map(f => f.name);

  const widths = columns.map((col) => {
    const vals = rows.map(r => String(r[col] ?? 'NULL'));
    return Math.max(col.length, ...vals.map(v => v.length));
  });

  const sep = '+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+';

  const header = '|' + columns.map((col, i) =>
    ' ' + col.padEnd(widths[i]) + ' '
  ).join('|') + '|';

  console.log(sep);
  console.log(header);
  console.log(sep);

  for (const row of rows) {
    const line = '|' + columns.map((col, i) => {
      const val = String(row[col] ?? 'NULL');
      return ' ' + val.padEnd(widths[i]) + ' ';
    }).join('|') + '|';
    console.log(line);
  }

  console.log(sep);
  console.log(`(${rows.length} row${rows.length === 1 ? '' : 's'})`);
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  const p = readAdapterParams(adapterDir);

  for (const key of ['host', 'port', 'database', 'user', 'password']) {
    if (!p[key]) {
      console.error(`Erro: param "${key}" ausente no ADAPTER.yaml (${adapterDir}).`);
      process.exit(1);
    }
  }

  const client = new Client({
    host: p.host,
    port: Number(p.port),
    database: p.database,
    user: p.user,
    password: p.password,
    connectionTimeoutMillis: 10_000,
  });

  try {
    await client.connect();

    if (mode === 'query') {
      const result = await client.query(sql);
      formatTable(result.rows, result.fields);
    } else {
      const result = await client.query(sql);
      console.log(`Query OK, ${result.rowCount} row(s) affected`);
    }
  } catch (err) {
    console.error(`Erro ao executar SQL: ${err.message}`);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
