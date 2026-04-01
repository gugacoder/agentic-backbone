#!/usr/bin/env node

/**
 * setup.mjs — Gera chaves obrigatorias para o .env.
 *
 * Usage:
 *   npm run setup
 *
 * Gera valores seguros para JWT_SECRET e ENCRYPTION_KEY se nao estiverem
 * definidos ou se estiverem com os valores default do .env.example.
 */

import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ENV_PATH = resolve(ROOT, ".env");
const ENV_EXAMPLE = resolve(ROOT, ".env.example");

const INSECURE_DEFAULTS = [
  "backbone-dev-jwt-secret-change-in-production-2026",
];

function generateSecret(bytes = 48) {
  return randomBytes(bytes).toString("base64url");
}

function run() {
  if (!existsSync(ENV_PATH)) {
    if (!existsSync(ENV_EXAMPLE)) {
      console.error("[setup] .env.example nao encontrado");
      process.exit(1);
    }
    writeFileSync(ENV_PATH, readFileSync(ENV_EXAMPLE, "utf-8"));
    console.log("[setup] .env criado a partir de .env.example");
  }

  let env = readFileSync(ENV_PATH, "utf-8");
  let changed = false;

  const keys = ["JWT_SECRET", "ENCRYPTION_KEY"];

  for (const key of keys) {
    const re = new RegExp(`^${key}=(.*)$`, "m");
    const match = env.match(re);
    const current = match?.[1]?.trim();

    if (!current || INSECURE_DEFAULTS.includes(current)) {
      const secret = generateSecret();
      if (match) {
        env = env.replace(re, `${key}=${secret}`);
      } else {
        env += `\n${key}=${secret}\n`;
      }
      console.log(`[setup] ${key} gerado (${secret.length} chars)`);
      changed = true;
    } else {
      console.log(`[setup] ${key} ja configurado — mantido`);
    }
  }

  if (changed) {
    writeFileSync(ENV_PATH, env);
    console.log("[setup] .env atualizado");
  } else {
    console.log("[setup] nada a fazer");
  }
}

run();
