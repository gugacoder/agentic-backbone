#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════
// Evolution Connector — Executor HTTP para Evolution API v2
//
// Interface:
//   node exec.mjs <adapter-dir> <get|send> <endpoint> [json-body]
//
// Exemplos:
//   node exec.mjs ../../adapters/evolution get "/instance/connectionState/evolution"
//   node exec.mjs ../../adapters/evolution send "/message/sendText/evolution" '{"number":"5511...","text":"Olá!"}'
//
// Lê params de ADAPTER.yaml no adapter-dir.
// ══════════════════════════════════════════════════════════════════

import { createAdapter } from './adapter.mjs';

// ── Args ──────────────────────────────────────────────────────────

const [adapterDir, mode, endpoint, body] = process.argv.slice(2);

if (!adapterDir || !mode || !endpoint) {
  console.error('Uso: node exec.mjs <adapter-dir> <get|send> <endpoint> [json-body]');
  process.exit(1);
}

if (mode !== 'get' && mode !== 'send') {
  console.error(`Erro: modo inválido "${mode}". Use "get" ou "send".`);
  process.exit(1);
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  const adapter = createAdapter(adapterDir);

  try {
    let data;
    if (mode === 'get') {
      data = await adapter.get(endpoint);
    } else {
      const parsed = body ? JSON.parse(body) : {};
      data = await adapter.send(endpoint, parsed);
    }
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    if (err.name === 'TimeoutError') {
      console.error(`Erro: timeout ao conectar (15s)`);
    } else {
      console.error(`Erro: ${err.message}`);
    }
    process.exit(1);
  }
}

main();
