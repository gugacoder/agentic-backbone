import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import mammoth from "mammoth";
import XLSX from "xlsx";
import type { ImagePart, FilePart, TextPart } from "ai";

const MB = 1024 * 1024;

export const MIME_LIMITS: Record<string, number> = {
  "image/png": 20 * MB,
  "image/jpeg": 20 * MB,
  "image/gif": 20 * MB,
  "image/webp": 20 * MB,
  "audio/wav": 25 * MB,
  "audio/mp3": 25 * MB,
  "audio/mpeg": 25 * MB,
  "audio/ogg": 25 * MB,
  "audio/webm": 25 * MB,
  "application/pdf": 30 * MB,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": 15 * MB,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": 10 * MB,
  "text/plain": 5 * MB,
  "text/csv": 5 * MB,
  "application/json": 5 * MB,
};

export const ACCEPTED_MIME_TYPES = new Set(Object.keys(MIME_LIMITS));

export const TOTAL_SIZE_LIMIT = 50 * MB;
export const MAX_FILES = 10;

export function generateAttachmentId(originalName: string): string {
  const ts = Date.now();
  const hex = randomBytes(3).toString("hex");
  const ext = extname(originalName);
  return `att_${ts}_${hex}${ext}`;
}

export function sessionAttachmentsDir(sessionDir: string): string {
  return join(sessionDir, "attachments");
}

export async function saveAttachment(
  sessionDir: string,
  file: File
): Promise<{ id: string; path: string }> {
  const id = generateAttachmentId(file.name);
  const dir = sessionAttachmentsDir(sessionDir);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, id);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);
  return { id, path: filePath };
}

// ─── Classifier ───────────────────────────────────────────────────────────────

// Runtime content parts — binary parts carry _ref for JSONL persistence
export type ContentPart =
  | TextPart
  | (ImagePart & { _ref?: string })
  | (FilePart & { _ref?: string });

export interface AttachmentInfo {
  filePath: string;
  mimeType: string;
  filename: string;
}

export interface ClassifiedPart {
  part: ContentPart;
  ref: string;
}

const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const AUDIO_MIMES = new Set(["audio/wav", "audio/mp3", "audio/mpeg", "audio/ogg", "audio/webm"]);
const TEXT_MIMES = new Set(["text/plain", "text/csv", "application/json"]);
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function classifyAttachment(info: AttachmentInfo): Promise<ClassifiedPart> {
  const { filePath, mimeType, filename } = info;

  if (IMAGE_MIMES.has(mimeType)) {
    const buffer = await readFile(filePath);
    const base64 = buffer.toString("base64");
    const part: ImagePart & { _ref: string } = { type: "image", image: base64, mimeType, _ref: filename };
    return { part, ref: filename };
  }

  if (mimeType === "application/pdf" || AUDIO_MIMES.has(mimeType)) {
    const buffer = await readFile(filePath);
    const base64 = buffer.toString("base64");
    const part: FilePart & { _ref: string } = { type: "file", data: base64, mimeType, _ref: filename };
    return { part, ref: filename };
  }

  if (TEXT_MIMES.has(mimeType)) {
    const text = await readFile(filePath, "utf-8");
    const part: TextPart = { type: "text", text: `[📎 ${filename}]\n${text}` };
    return { part, ref: filename };
  }

  if (mimeType === DOCX_MIME) {
    const buffer = await readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    const part: TextPart = { type: "text", text: `[📎 ${filename}]\n${result.value}` };
    return { part, ref: filename };
  }

  if (mimeType === XLSX_MIME) {
    const buffer = await readFile(filePath);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheets = workbook.SheetNames.map((name) => {
      const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name]!);
      return `### ${name}\n${csv}`;
    });
    const part: TextPart = { type: "text", text: `[📎 ${filename}]\n${sheets.join("\n\n")}` };
    return { part, ref: filename };
  }

  // Fallback: treat as plain text
  const text = await readFile(filePath, "utf-8");
  const part: TextPart = { type: "text", text: `[📎 ${filename}]\n${text}` };
  return { part, ref: filename };
}

export async function buildContentArray(
  message: string | undefined,
  attachments: AttachmentInfo[]
): Promise<ContentPart[]> {
  const parts: ContentPart[] = [];

  if (message && message.trim()) {
    parts.push({ type: "text", text: message });
  }

  for (const attachment of attachments) {
    const classified = await classifyAttachment(attachment);
    parts.push(classified.part);
  }

  return parts;
}
