import type { AgentEvent, UsageData } from "../agent/index.js";

export interface AgentResult {
  fullText: string;
  usage?: UsageData;
}

export async function collectAgentResult(
  stream: AsyncIterable<AgentEvent>
): Promise<AgentResult> {
  let fullText = "";
  let usage: UsageData | undefined;
  for await (const event of stream) {
    if (event.type === "result" && event.content) {
      fullText = event.content;
    } else if (event.type === "text" && event.content) {
      fullText += event.content;
    } else if (event.type === "usage" && event.usage) {
      usage = event.usage;
    }
  }
  return { fullText, usage };
}
