import { streamText, type CoreMessage } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { codingTools } from "./tools/index.js";
import { createAskUserTool } from "./tools/ask-user.js";
import { createWebSearchTool } from "./tools/web-search.js";
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

  // Override pluggable tools with configured callbacks if provided
  let tools = { ...codingTools };
  if (options.onAskUser) {
    tools = { ...tools, AskUser: createAskUserTool(options.onAskUser) };
  }
  if (options.onWebSearch) {
    tools = { ...tools, WebSearch: createWebSearchTool(options.onWebSearch) };
  }

  let result;
  try {
    result = streamText({
      model: openrouter(options.model),
      tools,
      maxSteps: options.maxSteps ?? DEFAULT_MAX_STEPS,
      messages,
      ...(options.system ? { system: options.system } : {}),
      onStepFinish: () => {},
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`OpenRouter request failed: ${msg}`);
  }

  // Stream text deltas — surface API errors instead of hanging
  let fullText = "";
  try {
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        fullText += part.textDelta;
        yield { type: "text", content: part.textDelta };
      } else if (part.type === "error") {
        const errMsg = (part as any).error?.message ?? JSON.stringify((part as any).error ?? part);
        throw new Error(`OpenRouter API error: ${errMsg}`);
      }
    }
  } catch (err) {
    // Re-throw with context if it's not already our error
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.startsWith("OpenRouter")) {
      throw new Error(`OpenRouter stream error: ${msg}`);
    }
    throw err;
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

  // Fetch cost from OpenRouter generation endpoint
  let totalCostUsd = 0;
  try {
    const genId = (await result.response).id;
    if (genId) {
      // Small delay — OpenRouter may not have the generation ready immediately
      await new Promise((r) => setTimeout(r, 500));
      const res = await fetch(`https://openrouter.ai/api/v1/generation?id=${genId}`, {
        headers: { Authorization: `Bearer ${options.apiKey}` },
      });
      if (res.ok) {
        const gen = (await res.json()) as { data?: { total_cost?: number } };
        totalCostUsd = gen.data?.total_cost ?? 0;
      }
    }
  } catch {
    // Non-critical — cost stays 0
  }

  yield { type: "result", content: fullText };
  yield {
    type: "usage",
    usage: {
      inputTokens: usage.promptTokens ?? 0,
      outputTokens: usage.completionTokens ?? 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      totalCostUsd,
      numTurns: steps.length,
      durationMs: Date.now() - startMs,
      durationApiMs: 0,
      stopReason: finishReason ?? "unknown",
    },
  };
}
