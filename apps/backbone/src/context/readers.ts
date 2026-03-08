import {
  readFileSync,
  writeFileSync,
  openSync,
  fsyncSync,
  closeSync,
  renameSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join, dirname, basename } from "node:path";
import { randomBytes } from "node:crypto";
import yaml from "js-yaml";
import { processYamlFields } from "../utils/encryption.js";

// ── Env interpolation ────────────────────────────────────

/** Interpola ${VAR} com process.env */
export function interpolateEnvVars(raw: string): string {
  return raw.replace(/\$\{([^}]+)\}/g, (_, key) => {
    const val = process.env[key.trim()];
    if (val === undefined) {
      console.warn(`[interpolate] env var not found: ${key.trim()}`);
      return "";
    }
    return val;
  });
}

// ── Frontmatter parsing ──────────────────────────────────

export interface ParsedMarkdown {
  metadata: Record<string, unknown>;
  content: string;
}

export function parseFrontmatter(raw: string): ParsedMarkdown {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { metadata: {}, content: raw };

  const yamlBlock = match[1];
  const content = match[2];

  const metadata: Record<string, unknown> = {};
  for (const line of yamlBlock.split(/\r?\n/)) {
    const kv = line.match(/^([\w][\w-]*):\s*(.+)$/);
    if (!kv) continue;
    const val = kv[2].trim();
    if (val === "true") metadata[kv[1]] = true;
    else if (val === "false") metadata[kv[1]] = false;
    else if (/^\d+$/.test(val)) metadata[kv[1]] = Number(val);
    else metadata[kv[1]] = val.replace(/^["']|["']$/g, "");
  }

  return { metadata, content };
}

export function serializeFrontmatter(
  metadata: Record<string, unknown>,
  content: string
): string {
  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      const needsQuoting = /[:#\[\]{}&*!|>'"%@`]/.test(value) || value === "";
      lines.push(`${key}: ${needsQuoting ? `"${value.replace(/"/g, '\\"')}"` : value}`);
    } else {
      lines.push(`${key}: ${String(value)}`);
    }
  }
  lines.push("---");
  return lines.join("\n") + "\n" + content;
}

// ── Atomic file write ────────────────────────────────────

export function writeFileAtomic(filePath: string, content: string): void {
  const dir = dirname(filePath);
  const tmpName = `.tmp-${basename(filePath)}-${randomBytes(6).toString("hex")}`;
  const tmpPath = join(dir, tmpName);

  try {
    writeFileSync(tmpPath, content, "utf-8");
    const fd = openSync(tmpPath, "r+");
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }

    try {
      renameSync(tmpPath, filePath);
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "EBUSY" || code === "EACCES" || code === "EPERM") {
        rmSync(filePath, { force: true });
        renameSync(tmpPath, filePath);
      } else {
        throw err;
      }
    }
  } catch (err) {
    try {
      if (existsSync(tmpPath)) rmSync(tmpPath, { force: true });
    } catch {
      // best-effort cleanup
    }
    throw err;
  }
}

// ── Frontmatter update (partial merge) ───────────────────

export function updateFrontmatter(
  filePath: string,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const raw = readFileSync(filePath, "utf-8");
  const { metadata, content } = parseFrontmatter(raw);

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    metadata[key] = value;
  }

  const serialized = serializeFrontmatter(metadata, content);
  writeFileAtomic(filePath, serialized);

  return metadata;
}

// ── Markdown reader/writer (.md with frontmatter) ────────

export function readMarkdown(filePath: string): ParsedMarkdown {
  const raw = interpolateEnvVars(readFileSync(filePath, "utf-8"));
  return parseFrontmatter(raw);
}

export function writeMarkdown(
  filePath: string,
  metadata: Record<string, unknown>,
  content: string
): void {
  writeFileAtomic(filePath, serializeFrontmatter(metadata, content));
}

// ── YAML reader/writer (.yml metadata files) ─────────────

export function readYaml(filePath: string): Record<string, unknown> {
  const raw = interpolateEnvVars(readFileSync(filePath, "utf-8"));
  const parsed = yaml.load(raw);
  const obj = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  return processYamlFields(obj, "decrypt");
}

export function writeYaml(filePath: string, data: Record<string, unknown>): void {
  const encrypted = processYamlFields(data, "encrypt");
  const content = yaml.dump(encrypted, { lineWidth: -1, quotingType: '"' });
  writeFileAtomic(filePath, content);
}

// ── Legacy compat (used by resolver for plain .md without frontmatter) ──

/** Le arquivo de contexto com interpolacao de env vars */
export function readContextFile(filePath: string): string {
  return interpolateEnvVars(readFileSync(filePath, "utf-8"));
}
