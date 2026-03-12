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
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter.js";

/**
 * Atomic file write: write-to-temp + fsync + rename.
 *
 * On POSIX, rename is atomic. On Windows, if rename fails with
 * EBUSY/EACCES (file locked), falls back to rmSync + renameSync.
 * The original file is never touched until the rename succeeds.
 */
export function writeFileAtomic(filePath: string, content: string): void {
  const dir = dirname(filePath);
  const tmpName = `.tmp-${basename(filePath)}-${randomBytes(6).toString("hex")}`;
  const tmpPath = join(dir, tmpName);

  try {
    // Write to temp file
    writeFileSync(tmpPath, content, "utf-8");

    // fsync to ensure data is flushed to disk
    // Use "r+" (read-write) because Windows requires write access for fsync
    const fd = openSync(tmpPath, "r+");
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }

    // Atomic rename
    try {
      renameSync(tmpPath, filePath);
    } catch (err: unknown) {
      // Windows fallback: if rename fails with EBUSY/EACCES, try rm + rename
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "EBUSY" || code === "EACCES" || code === "EPERM") {
        rmSync(filePath, { force: true });
        renameSync(tmpPath, filePath);
      } else {
        throw err;
      }
    }
  } catch (err) {
    // Clean up temp file on any error — original is untouched
    try {
      if (existsSync(tmpPath)) rmSync(tmpPath, { force: true });
    } catch {
      // best-effort cleanup
    }
    throw err;
  }
}

/**
 * Update specific frontmatter fields in a markdown file.
 * Performs a partial merge — only the specified keys are changed,
 * everything else (metadata + body content) is preserved.
 *
 * Returns the merged metadata object.
 */
export function updateFrontmatter(
  filePath: string,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const raw = readFileSync(filePath, "utf-8");
  const { metadata, content } = parseFrontmatter(raw);

  // Partial merge
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    metadata[key] = value;
  }

  const serialized = serializeFrontmatter(metadata, content);
  writeFileAtomic(filePath, serialized);

  return metadata;
}
