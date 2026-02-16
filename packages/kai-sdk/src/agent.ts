import { streamText, type CoreMessage } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { codingTools } from "./tools/index.js";
import { loadSession, saveSession } from "./session.js";
import type { KaiAgentEvent, KaiAgentOptions } from "./types.js";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

const DEFAULT_SESSION_DIR = join(process.cwd(), "data", "kai-sessions");
const DEFAULT_MAX_STEPS = 30;

export async function* runKaiAgent(
  prompt: string,
  options: KaiAgentOptions
): AsyncGenerator<KaiAgentEvent> {
  const openrouter = createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: options.apiKey,
  });

  const sessionDir = options.sessionDir ?? DEFAULT_SESSION_DIR;
  const sessionId = options.sessionId ?? randomUUID();

  // Session resume: load history if sessionId was provided
  let previousMessages: CoreMessage[] = [];
  if (options.sessionId) {
    previousMessages = await loadSession(sessionDir, options.sessionId);
  }

  const startMs = Date.now();
  const messages: CoreMessage[] = [
    ...previousMessages,
    { role: "user", content: prompt },
  ];

  yield { type: "init", sessionId };

  const result = streamText({
    model: openrouter(options.model),
    tools: codingTools,
    maxSteps: options.maxSteps ?? DEFAULT_MAX_STEPS,
    messages,
    ...(options.system ? { system: options.system } : {}),
    onStepFinish: ({ toolCalls }) => {
      if (toolCalls) {
        for (const tc of toolCalls) {
          console.log(`[kai:tool] ${tc.toolName}`);
        }
      }
    },
  });

  // Stream text deltas
  let fullText = "";
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      fullText += part.textDelta;
      yield { type: "text", content: part.textDelta };
    }
  }

  // Persist session
  const response = await result.response;
  await saveSession(sessionDir, sessionId, [
    ...messages,
    ...response.messages as CoreMessage[],
  ]);

  // Final result + usage
  const usage = await result.usage;
  const steps = await result.steps;
  const finishReason = await result.finishReason;

  yield { type: "result", content: fullText };
  yield {
    type: "usage",
    usage: {
      inputTokens: usage.promptTokens ?? 0,
      outputTokens: usage.completionTokens ?? 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      totalCostUsd: 0,
      numTurns: steps.length,
      durationMs: Date.now() - startMs,
      durationApiMs: 0,
      stopReason: finishReason ?? "unknown",
    },
  };
}
