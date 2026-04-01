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
import { type ZodType } from "zod";
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

  const parsed = yaml.load(match[1]);
  const metadata = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  return { metadata, content: match[2] };
}

export function serializeFrontmatter(
  metadata: Record<string, unknown>,
  content: string
): string {
  const clean = Object.fromEntries(
    Object.entries(metadata).filter(([, v]) => v !== undefined && v !== null)
  );
  const yamlBlock = Object.keys(clean).length > 0
    ? yaml.dump(clean, { lineWidth: -1, quotingType: '"' }).trimEnd()
    : "";
  return `---\n${yamlBlock}\n---\n${content}`;
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

// ── Typed wrappers with Zod validation ──────────────────

export function readYamlAs<T>(filePath: string, schema: ZodType<T>): T {
  return schema.parse(readYaml(filePath));
}

export function writeYamlAs<T>(
  filePath: string,
  data: T,
  schema: ZodType<T>
): void {
  writeYaml(filePath, schema.parse(data) as Record<string, unknown>);
}

export function readMarkdownAs<T>(
  filePath: string,
  schema: ZodType<T>
): { metadata: T; content: string } {
  const { metadata, content } = readMarkdown(filePath);
  return { metadata: schema.parse(metadata), content };
}

export function writeMarkdownAs<T>(
  filePath: string,
  metadata: T,
  content: string,
  schema: ZodType<T>
): void {
  writeMarkdown(filePath, schema.parse(metadata) as Record<string, unknown>, content);
}

export function patchYamlAs<T>(
  filePath: string,
  patch: Record<string, unknown>,
  schema: ZodType<T>
): T {
  const current = existsSync(filePath) ? readYaml(filePath) : {};
  const merged = { ...current, ...patch };
  const validated = schema.parse(merged);
  writeYaml(filePath, validated as Record<string, unknown>);
  return validated;
}

export function patchMarkdownAs<T>(
  filePath: string,
  patch: Record<string, unknown>,
  schema: ZodType<T>,
  body?: string
): { metadata: T; content: string } {
  const { metadata: current, content: currentBody } = readMarkdown(filePath);
  const merged = { ...current, ...patch };
  const validated = schema.parse(merged);
  const finalBody = body !== undefined ? body : currentBody;
  writeMarkdown(filePath, validated as Record<string, unknown>, finalBody);
  return { metadata: validated, content: finalBody };
}
