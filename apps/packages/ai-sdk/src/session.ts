import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import type { ModelMessage } from "ai";

function sessionPath(dir: string): string {
  return join(dir, "messages.jsonl");
}

export async function resolveRefs(
  content: unknown[],
  attachmentsDir: string
): Promise<unknown[]> {
  const resolved: unknown[] = [];
  for (const part of content) {
    if (typeof part !== "object" || part === null) {
      resolved.push(part);
      continue;
    }
    const p = part as Record<string, unknown>;
    if (p._ref && (p.type === "image" || p.type === "file")) {
      const filename = basename(p._ref as string);
      const filePath = join(attachmentsDir, filename);
      try {
        const buffer = await readFile(filePath);
        const base64 = buffer.toString("base64");
        if (p.type === "image") {
          resolved.push({ type: "image", image: base64, mimeType: p.mimeType, _ref: p._ref });
        } else {
          resolved.push({ type: "file", data: base64, mimeType: p.mimeType, _ref: p._ref });
        }
      } catch {
        resolved.push({ type: "text", text: `[arquivo removido: ${filename}]` });
      }
    } else {
      resolved.push(part);
    }
  }
  return resolved;
}

export async function loadSession(dir: string): Promise<ModelMessage[]> {
  try {
    const content = await readFile(sessionPath(dir), "utf-8");
    const messages = content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const { _meta, ...msg } = JSON.parse(line);
        return msg as ModelMessage;
      });

    const attachmentsDir = join(dir, "attachments");
    const result: ModelMessage[] = [];
    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        const resolvedContent = await resolveRefs(msg.content, attachmentsDir);
        result.push({ ...msg, content: resolvedContent as ModelMessage["content"] });
      } else {
        result.push(msg);
      }
    }
    return result;
  } catch {
    return [];
  }
}

export function filterOldMedia(messages: ModelMessage[], lastUserIndex: number): ModelMessage[] {
  return messages.map((msg, i) => {
    if (msg.role !== "user" || i === lastUserIndex) {
      return msg;
    }
    if (!Array.isArray(msg.content)) {
      return msg;
    }
    const filtered = (msg.content as unknown[]).map((part) => {
      if (typeof part !== "object" || part === null) return part;
      const p = part as Record<string, unknown>;
      if (p.type === "image") {
        const name = (p._ref as string | undefined) ?? "imagem";
        return { type: "text", text: `[imagem enviada: ${name}]` };
      }
      if (p.type === "file" && p.data !== undefined) {
        const name = (p._ref as string | undefined) ?? "arquivo";
        return { type: "text", text: `[arquivo enviado: ${name}]` };
      }
      return part;
    });
    return { ...msg, content: filtered as ModelMessage["content"] };
  });
}

export async function saveSession(
  dir: string,
  messages: (ModelMessage & { _meta?: Record<string, unknown> })[]
): Promise<void> {
  const filePath = sessionPath(dir);
  await mkdir(dirname(filePath), { recursive: true });
  const ts = new Date().toISOString();
  const jsonl =
    messages
      .map((m) => {
        if (!(m as any)._meta) {
          return JSON.stringify({ ...m, _meta: { ts } });
        }
        return JSON.stringify(m);
      })
      .join("\n") + "\n";
  await writeFile(filePath, jsonl, "utf-8");
}
