#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════
// send-message — Envia mensagens para canais backbone ou WhatsApp
//
// Uso:
//   node send-message.mjs --channel <slug> --message "texto"
//   node send-message.mjs --whatsapp <numero> --message "texto"
//   node send-message.mjs --whatsapp <numero> --instance <nome> --message "texto"
//   node send-message.mjs --channel <slug> --whatsapp <numero> --message "texto"
//
// Env: BACKBONE_PORT, AUTH_TOKEN, AGENT_ID
// ══════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Args ──

function parseArgs(argv) {
  const args = { channel: null, whatsapp: null, instance: null, message: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--channel" && argv[i + 1]) args.channel = argv[++i];
    else if (argv[i] === "--whatsapp" && argv[i + 1]) args.whatsapp = argv[++i];
    else if (argv[i] === "--instance" && argv[i + 1]) args.instance = argv[++i];
    else if (argv[i] === "--message" && argv[i + 1]) args.message = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv);

if (!args.message) {
  console.error("Erro: --message é obrigatório");
  console.error(
    "Uso: node send-message.mjs --channel <slug> --message <texto>"
  );
  console.error(
    "     node send-message.mjs --whatsapp <numero> --message <texto>"
  );
  process.exit(1);
}

if (!args.channel && !args.whatsapp) {
  console.error("Erro: informe --channel <slug> e/ou --whatsapp <numero>");
  process.exit(1);
}

// ── Channel (backbone SSE) ──

async function sendToChannel(channelSlug, message) {
  const port = process.env.BACKBONE_PORT;
  if (!port) throw new Error("BACKBONE_PORT não definido");
  const token = process.env.AUTH_TOKEN;
  if (!token) throw new Error("AUTH_TOKEN não definido");

  const agentId = process.env.AGENT_ID || "system.main";
  const url = `http://localhost:${port}/api/channels/${channelSlug}/emit`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ agentId, content: message }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Canal ${channelSlug}: HTTP ${res.status} — ${body}`);
  }

  return await res.json();
}

// ── WhatsApp (Evolution API) ──

function findEvolutionAdapter() {
  // Walk up from tool dir looking for the evolution adapter
  // Precedence: agent → system → shared
  const candidates = [
    resolve(__dirname, "../../../system/adapters/evolution/ADAPTER.yaml"),
    resolve(__dirname, "../../adapters/evolution/ADAPTER.yaml"),
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  throw new Error(
    "Adapter Evolution não encontrado. Verifique context/shared/adapters/evolution/ADAPTER.yaml"
  );
}

function readAdapterParams(yamlPath) {
  const content = readFileSync(yamlPath, "utf-8");
  const params = {};
  let inParams = false;
  for (const line of content.split("\n")) {
    if (line.trimEnd() === "params:") {
      inParams = true;
      continue;
    }
    if (inParams) {
      if (line.length > 0 && !line.startsWith(" ") && !line.startsWith("\t"))
        break;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) continue;
      params[trimmed.slice(0, colonIdx).trim()] = trimmed
        .slice(colonIdx + 1)
        .trim();
    }
  }
  return params;
}

function resolveEvolutionConfig(instanceOverride) {
  // Env vars take precedence (.env is the single source of truth)
  const envUrl = process.env.EVOLUTION_URL;
  const envKey = process.env.EVOLUTION_API_KEY;
  const envInstance = process.env.EVOLUTION_INSTANCE_NAME;

  if (envUrl && envKey) {
    return {
      baseUrl: envUrl.replace(/\/+$/, ""),
      apiKey: envKey,
      instance: instanceOverride || envInstance || "evolution",
    };
  }

  // Fallback: read ADAPTER.yaml
  const yamlPath = findEvolutionAdapter();
  const params = readAdapterParams(yamlPath);

  for (const key of ["host", "port", "api_key"]) {
    if (!params[key])
      throw new Error(`Param "${key}" ausente no ADAPTER.yaml e env vars EVOLUTION_URL/EVOLUTION_API_KEY não definidas`);
  }

  return {
    baseUrl: `http://${params.host}:${params.port}`,
    apiKey: params.api_key,
    instance: instanceOverride || params.instance_name || "evolution",
  };
}

async function sendToWhatsApp(number, message, instanceOverride) {
  const { baseUrl, apiKey, instance } = resolveEvolutionConfig(instanceOverride);
  const endpoint = `/message/sendText/${instance}`;

  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ number, text: message }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp ${number}: HTTP ${res.status} — ${body}`);
  }

  return await res.json();
}

// ── Main ──

const results = [];

if (args.channel) {
  try {
    const r = await sendToChannel(args.channel, args.message);
    console.log(`[canal:${args.channel}] OK`, JSON.stringify(r));
    results.push({ target: `canal:${args.channel}`, status: "ok" });
  } catch (err) {
    console.error(`[canal:${args.channel}] ERRO:`, err.message);
    results.push({
      target: `canal:${args.channel}`,
      status: "error",
      error: err.message,
    });
  }
}

if (args.whatsapp) {
  try {
    const r = await sendToWhatsApp(args.whatsapp, args.message, args.instance);
    console.log(`[whatsapp:${args.whatsapp}] OK`, JSON.stringify(r));
    results.push({ target: `whatsapp:${args.whatsapp}`, status: "ok" });
  } catch (err) {
    console.error(`[whatsapp:${args.whatsapp}] ERRO:`, err.message);
    results.push({
      target: `whatsapp:${args.whatsapp}`,
      status: "error",
      error: err.message,
    });
  }
}

const ok = results.filter((r) => r.status === "ok").length;
const fail = results.filter((r) => r.status === "error").length;
console.log(`\nResumo: ${ok} enviado(s), ${fail} erro(s)`);
process.exit(fail > 0 ? 1 : 0);
