import { runAgent } from "../agent/index.js";
import { agentMemoryPath } from "../context/paths.js";
import { getAgentMemoryManager } from "./manager.js";
import { existsSync, readFileSync, appendFileSync } from "node:fs";

export interface FlushResult {
  success: boolean;
  didWrite: boolean;
}

const NO_REPLY_TOKEN = "NO_REPLY";

export async function flushMemory(options: {
  agentId: string;
  sdkSessionId?: string;
  context?: string;
}): Promise<FlushResult> {
  const { agentId, sdkSessionId, context } = options;

  const prompt = [
    "You are performing a memory flush. Review the conversation so far and identify important facts, decisions, preferences, or context that should be remembered long-term.",
    "",
    context ? `<conversation_context>\n${context}\n</conversation_context>\n` : "",
    "Instructions:",
    "1. Identify key facts worth remembering (new information, user preferences, decisions made, important context).",
    "2. If there are facts worth saving, append them to MEMORY.md using the Write tool. Use a dated section header (## YYYY-MM-DD) and bullet points.",
    "3. Do NOT duplicate information already in MEMORY.md.",
    "4. After writing (or if nothing new), respond with exactly: NO_REPLY",
    "",
    `Memory file path: ${agentMemoryPath(agentId)}`,
  ].join("\n");

  try {
    let fullText = "";

    for await (const event of runAgent(prompt, {
      sdkSessionId,
      role: "memory",
    })) {
      if (event.type === "result" && event.content) {
        fullText = event.content;
      } else if (event.type === "text" && event.content) {
        fullText += event.content;
      }
    }

    const didWrite = !fullText.includes(NO_REPLY_TOKEN);

    // Trigger re-indexing if memory was written
    if (didWrite && process.env.OPENAI_API_KEY) {
      try {
        const mgr = getAgentMemoryManager(agentId);
        await mgr.sync({ force: true });
      } catch {
        // Non-critical — indexing will catch up
      }
    }

    return { success: true, didWrite };
  } catch (err) {
    console.error(`[memory-flush:${agentId}] failed:`, err);
    return { success: false, didWrite: false };
  }
}
