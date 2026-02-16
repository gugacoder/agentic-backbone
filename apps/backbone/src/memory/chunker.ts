import { createHash } from "node:crypto";
import type { MemoryChunk } from "./types.js";

export function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function chunkMarkdown(
  content: string,
  opts: { tokens?: number; overlap?: number } = {}
): MemoryChunk[] {
  const maxChars = (opts.tokens ?? 400) * 4;
  const overlapChars = (opts.overlap ?? 80) * 4;
  const lines = content.split("\n");

  const chunks: MemoryChunk[] = [];
  let buf: string[] = [];
  let bufChars = 0;
  let startLine = 1;

  function flush(endLine: number): void {
    if (buf.length === 0) return;
    const text = buf.join("\n").trim();
    if (text.length === 0) return;

    chunks.push({
      startLine,
      endLine,
      text,
      hash: hashText(text),
    });

    // Carry overlap lines
    const overlapLines: string[] = [];
    let overlapLen = 0;
    for (let i = buf.length - 1; i >= 0; i--) {
      overlapLen += buf[i].length + 1;
      if (overlapLen > overlapChars) break;
      overlapLines.unshift(buf[i]);
    }

    buf = overlapLines;
    bufChars = overlapLines.reduce((sum, l) => sum + l.length + 1, 0);
    startLine = endLine - overlapLines.length + 1;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Split lines that are themselves too long
    if (line.length > maxChars) {
      flush(i); // flush buffer before this big line
      let pos = 0;
      const lineNum = i + 1;
      while (pos < line.length) {
        const segment = line.slice(pos, pos + maxChars);
        chunks.push({
          startLine: lineNum,
          endLine: lineNum,
          text: segment,
          hash: hashText(segment),
        });
        pos += maxChars;
      }
      buf = [];
      bufChars = 0;
      startLine = i + 2;
      continue;
    }

    buf.push(line);
    bufChars += line.length + 1;

    if (bufChars >= maxChars) {
      flush(i + 1);
    }
  }

  flush(lines.length);
  return chunks;
}
