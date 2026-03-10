import { readdirSync, statSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

// Clean files in data/uploads/ older than 7 days
const UPLOADS_DIR = resolve(process.cwd(), "data/uploads");
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

let sweepTimer: ReturnType<typeof setInterval> | null = null;

export function cleanUploads(): void {
  if (!existsSync(UPLOADS_DIR)) return;

  const now = Date.now();
  let deletedFiles = 0;
  let deletedDirs = 0;

  try {
    // Each session has its own subdirectory
    const sessionDirs = readdirSync(UPLOADS_DIR);
    for (const sessionId of sessionDirs) {
      const sessionPath = join(UPLOADS_DIR, sessionId);
      try {
        const stat = statSync(sessionPath);
        if (!stat.isDirectory()) continue;

        const files = readdirSync(sessionPath);
        for (const file of files) {
          const filePath = join(sessionPath, file);
          try {
            const fileStat = statSync(filePath);
            if (now - fileStat.mtimeMs > MAX_AGE_MS) {
              rmSync(filePath, { force: true });
              deletedFiles++;
            }
          } catch {
            // File may have been deleted concurrently
          }
        }

        // Remove empty session directory
        const remaining = readdirSync(sessionPath);
        if (remaining.length === 0) {
          rmSync(sessionPath, { recursive: true, force: true });
          deletedDirs++;
        }
      } catch {
        // Session dir may have been deleted concurrently
      }
    }
  } catch {
    // uploads dir may not exist yet — that's OK
  }

  if (deletedFiles > 0 || deletedDirs > 0) {
    console.log(`[uploads] cleanup: removed ${deletedFiles} file(s), ${deletedDirs} dir(s)`);
  }
}

export function startUploadsCleaner(): void {
  if (sweepTimer) return;

  // Run once at startup, then every 24h
  cleanUploads();
  sweepTimer = setInterval(cleanUploads, SWEEP_INTERVAL_MS);
  console.log("[uploads] cleanup scheduled (every 24h, max age 7 days)");
}

export function stopUploadsCleaner(): void {
  if (!sweepTimer) return;
  clearInterval(sweepTimer);
  sweepTimer = null;
}
