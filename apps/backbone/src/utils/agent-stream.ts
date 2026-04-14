import type { SDKMessage, SDKAssistantMessage, SDKResultMessage } from "../agent/index.js";
import type { UsageData } from "../agent/index.js";

export interface AgentResult {
  fullText: string;
  usage?: UsageData;
}

/**
 * Extracts UsageData from an SDKResultMessage.
 */
export function extractUsage(msg: SDKResultMessage): UsageData {
  return {
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
    cacheReadInputTokens: msg.usage.cache_read_input_tokens,
    cacheCreationInputTokens: msg.usage.cache_creation_input_tokens,
    totalCostUsd: msg.total_cost_usd,
    numTurns: msg.num_turns,
    durationMs: msg.duration_ms,
    durationApiMs: msg.duration_api_ms,
    stopReason: msg.stop_reason ?? "end_turn",
  };
}

/**
 * Extracts text content from an SDKAssistantMessage's content blocks.
 */
export function extractText(msg: SDKAssistantMessage): string {
  return msg.message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");
}

export async function collectAgentResult(
  stream: AsyncIterable<SDKMessage>
): Promise<AgentResult> {
  let fullText = "";
  let usage: UsageData | undefined;
  for await (const msg of stream) {
    if (msg.type === "assistant") {
      fullText += extractText(msg as SDKAssistantMessage);
    } else if (msg.type === "result") {
      const resultMsg = msg as SDKResultMessage;
      usage = extractUsage(resultMsg);
      if (resultMsg.subtype === "success" && resultMsg.result) {
        fullText = resultMsg.result;
      }
    }
  }
  return { fullText, usage };
}
