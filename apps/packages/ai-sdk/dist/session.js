import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
function sessionPath(dir, sessionId) {
    return join(dir, `${sessionId}.jsonl`);
}
export async function loadSession(dir, sessionId) {
    try {
        const content = await readFile(sessionPath(dir, sessionId), "utf-8");
        return content
            .split("\n")
            .filter((line) => line.trim())
            .map((line) => JSON.parse(line));
    }
    catch {
        return [];
    }
}
export async function saveSession(dir, sessionId, messages) {
    const filePath = sessionPath(dir, sessionId);
    await mkdir(dirname(filePath), { recursive: true });
    const jsonl = messages.map((m) => JSON.stringify(m)).join("\n") + "\n";
    await writeFile(filePath, jsonl, "utf-8");
}
