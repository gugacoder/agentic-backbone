import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
function sessionPath(dir) {
    return join(dir, "messages.jsonl");
}
export async function resolveRefs(content, attachmentsDir) {
    const resolved = [];
    for (const part of content) {
        if (typeof part !== "object" || part === null) {
            resolved.push(part);
            continue;
        }
        const p = part;
        if (p._ref && (p.type === "image" || p.type === "file")) {
            const filename = basename(p._ref);
            const filePath = join(attachmentsDir, filename);
            try {
                const buffer = await readFile(filePath);
                const base64 = buffer.toString("base64");
                if (p.type === "image") {
                    resolved.push({ type: "image", image: base64, mimeType: p.mimeType, _ref: p._ref });
                }
                else {
                    resolved.push({ type: "file", data: base64, mimeType: p.mimeType, _ref: p._ref });
                }
            }
            catch {
                resolved.push({ type: "text", text: `[arquivo removido: ${filename}]` });
            }
        }
        else {
            resolved.push(part);
        }
    }
    return resolved;
}
export async function loadSession(dir) {
    try {
        const content = await readFile(sessionPath(dir), "utf-8");
        const messages = content
            .split("\n")
            .filter((line) => line.trim())
            .map((line) => {
            const { _meta, ...msg } = JSON.parse(line);
            return msg;
        });
        const attachmentsDir = join(dir, "attachments");
        const result = [];
        for (const msg of messages) {
            if (Array.isArray(msg.content)) {
                const resolvedContent = await resolveRefs(msg.content, attachmentsDir);
                result.push({ ...msg, content: resolvedContent });
            }
            else {
                result.push(msg);
            }
        }
        return result;
    }
    catch {
        return [];
    }
}
export function filterOldMedia(messages, lastUserIndex) {
    return messages.map((msg, i) => {
        if (msg.role !== "user" || i === lastUserIndex) {
            return msg;
        }
        if (!Array.isArray(msg.content)) {
            return msg;
        }
        const filtered = msg.content.map((part) => {
            if (typeof part !== "object" || part === null)
                return part;
            const p = part;
            if (p.type === "image") {
                const name = p._ref ?? "imagem";
                return { type: "text", text: `[imagem enviada: ${name}]` };
            }
            if (p.type === "file" && p.data !== undefined) {
                const name = p._ref ?? "arquivo";
                return { type: "text", text: `[arquivo enviado: ${name}]` };
            }
            return part;
        });
        return { ...msg, content: filtered };
    });
}
export async function saveSession(dir, messages) {
    const filePath = sessionPath(dir);
    await mkdir(dirname(filePath), { recursive: true });
    const ts = new Date().toISOString();
    const jsonl = messages
        .map((m) => {
        if (!m._meta) {
            return JSON.stringify({ ...m, _meta: { ts } });
        }
        return JSON.stringify(m);
    })
        .join("\n") + "\n";
    await writeFile(filePath, jsonl, "utf-8");
}
