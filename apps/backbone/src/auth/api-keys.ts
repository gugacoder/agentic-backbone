import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { apiKeysDir } from "../context/paths.js";
import { readYamlAs } from "../context/readers.js";
import { ApiKeyYmlSchema } from "../context/schemas.js";

interface ApiKeyEntry {
  user: string;
  allowedAgents: string[];
}

const keyCache = new Map<string, ApiKeyEntry>();

export function loadApiKeys(): void {
  keyCache.clear();

  const dir = apiKeysDir();
  if (!existsSync(dir)) return;

  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".yml")) continue;

    try {
      const data = readYamlAs(join(dir, file), ApiKeyYmlSchema);
      keyCache.set(data["secret-key"], {
        user: data.user,
        allowedAgents: data["allowed-agents"] ?? [],
      });
    } catch (err) {
      console.warn(`[api-keys] failed to load ${file}:`, err);
    }
  }

  console.log(`[api-keys] loaded ${keyCache.size} key(s)`);
}

export function validateApiKey(
  token: string
): { user: string; role: "user"; allowedAgents: string[] } | null {
  const tokenBuf = Buffer.from(token, "utf-8");

  for (const [secret, entry] of keyCache) {
    const secretBuf = Buffer.from(secret, "utf-8");
    if (tokenBuf.length !== secretBuf.length) continue;
    if (timingSafeEqual(tokenBuf, secretBuf)) {
      return { user: entry.user, role: "user", allowedAgents: entry.allowedAgents };
    }
  }

  return null;
}
