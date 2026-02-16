// ══════════════════════════════════════════════════════════════════
// Evolution Connector — Factory Node.js para adapters Evolution API
//
// Uso:
//   import { createAdapter } from '../../connectors/evolution/adapter.mjs';
//   const adapter = createAdapter(adapterDir);
//   await adapter.send('/message/sendText/evolution', { number: '5511...', text: 'Olá!' });
//   await adapter.get('/instance/connectionState/evolution');
//
// Lê params de ADAPTER.yaml no adapterDir.
// Retorna { send, get, close } com HTTP stateless.
// ══════════════════════════════════════════════════════════════════

import { readFileSync } from 'fs';
import { resolve } from 'path';

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
  let config;

  function getConfig() {
    if (!config) {
      const p = readAdapterParams(adapterDir);
      for (const key of ['host', 'port', 'api_key', 'instance_name']) {
        if (!p[key]) {
          throw new Error(`Param "${key}" ausente no ADAPTER.yaml de ${adapterDir}`);
        }
      }
      config = {
        baseUrl: `http://${p.host}:${p.port}`,
        headers: {
          'apikey': p.api_key,
          'Content-Type': 'application/json',
        },
        instanceName: p.instance_name,
      };
    }
    return config;
  }

  async function get(endpoint) {
    const { baseUrl, headers } = getConfig();
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    return response.json();
  }

  async function send(endpoint, body) {
    const { baseUrl, headers } = getConfig();
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(15_000),
    });
    return response.json();
  }

  async function close() {
    // HTTP stateless — no-op
  }

  return { send, get, close };
}
