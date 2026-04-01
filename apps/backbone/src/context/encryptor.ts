import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { interpolateEnvVars, writeYaml, readYaml } from "./readers.js";
import { isSensitiveField } from "../utils/sensitive.js";
import { isEncrypted } from "../utils/encryption.js";

function hasPlaintextSensitiveFields(obj: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      if (hasPlaintextSensitiveFields(value as Record<string, unknown>)) return true;
    } else if (isSensitiveField(key) && value !== null && value !== undefined) {
      // Convert non-string values to string for sensitive field check
      const strValue = String(value);
      if (strValue !== "" && !isEncrypted(strValue) && !/^\$\{.+\}$/.test(strValue)) {
        return true;
      }
    }
  }
  return false;
}

/** Encrypts plaintext sensitive fields in a .yml file. Returns true if something was encrypted. */
export function encryptYamlFile(filePath: string): boolean {
  if (!existsSync(filePath)) return false;

  // Read raw YAML (with env interpolation but without decryption) to check for plaintext secrets
  const raw = interpolateEnvVars(readFileSync(filePath, "utf-8"));
  const parsed = yaml.load(raw);
  const obj = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;

  if (!hasPlaintextSensitiveFields(obj)) return false;

  // readYaml decrypts existing ENC() values, writeYaml re-encrypts all sensitive fields
  const data = readYaml(filePath);
  writeYaml(filePath, data);
  console.log(`[encryptor] encrypted sensitive fields in ${filePath}`);
  return true;
}

/** Recursively scan directory for .yml files and encrypt sensitive fields */
export function encryptAllYamlFiles(rootDir: string): void {
  if (!existsSync(rootDir)) return;

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith(".yml")) {
        try {
          encryptYamlFile(fullPath);
        } catch (err) {
          console.warn(`[encryptor] failed to process ${fullPath}:`, err);
        }
      }
    }
  }

  walk(rootDir);
}
