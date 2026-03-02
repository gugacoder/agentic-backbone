import type { ModelMessage } from "ai";
import { countTokens } from "./tokenizer.js";
import { getContextWindow } from "./models.js";
import type { ContextUsage } from "../types.js";

const DEFAULT_COMPACT_THRESHOLD = 0.65;

export interface GetContextUsageOptions {
  model: string;
  systemPrompt: string;
  toolDefinitions: Record<string, unknown>;
  messages: ModelMessage[];
  contextWindow?: number;
  compactThreshold?: number;
}

function countMessagesTokens(messages: ModelMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    if (typeof msg.content === "string") {
      total += countTokens(msg.content);
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if ("text" in part && typeof part.text === "string") {
          total += countTokens(part.text);
        }
      }
    }
    // Add overhead for role + message framing (~4 tokens per message)
    total += 4;
  }
  return total;
}

function countToolDefinitionsTokens(tools: Record<string, unknown>): number {
  if (!tools || Object.keys(tools).length === 0) return 0;
  return countTokens(JSON.stringify(tools));
}

export function getContextUsage(options: GetContextUsageOptions): ContextUsage {
  const contextWindow = getContextWindow(options.model, options.contextWindow);
  const compactThreshold = options.compactThreshold ?? DEFAULT_COMPACT_THRESHOLD;

  const systemPrompt = countTokens(options.systemPrompt);
  const toolDefinitions = countToolDefinitionsTokens(options.toolDefinitions);
  const messages = countMessagesTokens(options.messages);

  const used = systemPrompt + toolDefinitions + messages;
  const free = contextWindow - used;
  const usagePercent = (used / contextWindow) * 100;
  const willCompact = usagePercent >= compactThreshold * 100;

  return {
    model: options.model,
    contextWindow,
    systemPrompt,
    toolDefinitions,
    messages,
    used,
    free,
    usagePercent,
    compactThreshold: compactThreshold * 100,
    willCompact,
  };
}
