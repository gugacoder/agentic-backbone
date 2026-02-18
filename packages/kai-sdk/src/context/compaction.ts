import { generateObject, generateText, wrapLanguageModel, type CoreMessage, type LanguageModelV1Middleware, type TelemetrySettings } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import { countTokens } from "./tokenizer.js";
import { getContextWindow } from "./models.js";
import type { KaiTelemetryOptions } from "../types.js";
import type { createKaiProviderRegistry } from "../providers.js";

const CompactionSchema = z.object({
  summary: z.string().describe("Resumo conciso da conversa"),
  decisions: z.array(z.string()).describe("Decisoes tomadas"),
  filesModified: z.array(z.string()).describe("Arquivos modificados"),
  currentState: z.string().describe("Estado atual do trabalho"),
  nextSteps: z.array(z.string()).describe("Proximos passos"),
});

const TAIL_RATIO = 0.30;

const SUMMARIZATION_PROMPT = `Summarize the conversation below preserving: decisions made, files modified, current state of work, and next steps. Be concise.`;

export interface CompactOptions {
  model: string;
  apiKey: string;
  contextWindow?: number;
  systemPromptTokens: number;
  toolDefinitionsTokens: number;
  middleware?: LanguageModelV1Middleware[];
  telemetry?: KaiTelemetryOptions;
  /** Provider registry para reuso. Se nao fornecido, cria um internamente (backward compat). */
  providers?: ReturnType<typeof createKaiProviderRegistry>;
}

export interface CompactResult {
  messages: CoreMessage[];
  compacted: boolean;
  warning?: string;
}

function countMessageTokens(msg: CoreMessage): number {
  let tokens = 4; // overhead for role + framing
  if (typeof msg.content === "string") {
    tokens += countTokens(msg.content);
  } else if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if ("text" in part && typeof (part as any).text === "string") {
        tokens += countTokens((part as any).text);
      }
    }
  }
  return tokens;
}

function formatMessagesForSummary(messages: CoreMessage[]): string {
  return messages
    .map((msg) => {
      const role = msg.role;
      const content =
        typeof msg.content === "string"
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content
                .filter((p) => "text" in p)
                .map((p) => (p as any).text)
                .join("\n")
            : "[non-text content]";
      return `[${role}]: ${content}`;
    })
    .join("\n\n");
}

/**
 * Splits messages into head (to summarize) and tail (to keep intact).
 * Tail = last messages that fit within 30% of the context window.
 */
function splitMessages(
  messages: CoreMessage[],
  contextWindow: number
): { head: CoreMessage[]; tail: CoreMessage[] } {
  const tailBudget = Math.floor(contextWindow * TAIL_RATIO);
  let tailTokens = 0;
  let tailStart = messages.length;

  // Walk backwards to find tail boundary
  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = countMessageTokens(messages[i]);
    if (tailTokens + msgTokens > tailBudget) break;
    tailTokens += msgTokens;
    tailStart = i;
  }

  // Ensure at least one message in head (nothing to compact otherwise)
  if (tailStart <= 0) {
    tailStart = 1;
  }

  return {
    head: messages.slice(0, tailStart),
    tail: messages.slice(tailStart),
  };
}

/**
 * Compacts conversation messages by summarizing older messages (head)
 * and keeping recent messages (tail) intact.
 *
 * Uses the same model and apiKey as the agent for summarization.
 * If summarization fails, returns original messages with a warning.
 */
export async function compactMessages(
  messages: CoreMessage[],
  options: CompactOptions
): Promise<CompactResult> {
  // Nothing to compact if 2 or fewer messages
  if (messages.length <= 2) {
    return { messages, compacted: false };
  }

  const contextWindow = getContextWindow(options.model, options.contextWindow);
  const { head, tail } = splitMessages(messages, contextWindow);

  // If head is empty or has only 1 message, nothing to compact
  if (head.length <= 1) {
    return { messages, compacted: false };
  }

  const conversationText = formatMessagesForSummary(head);

  // Build telemetry config for compaction spans
  const telemetryConfig: TelemetrySettings | undefined =
    options.telemetry?.enabled
      ? {
          isEnabled: true,
          functionId: options.telemetry.functionId
            ? `${options.telemetry.functionId}-compaction`
            : "kai-compaction",
          recordInputs: false,
          recordOutputs: false,
          metadata: {
            ...options.telemetry.metadata,
          },
        }
      : undefined;

  try {
    const baseModel = options.providers
      ? options.providers.model(options.model)
      : createOpenAICompatible({
          name: "openrouter",
          baseURL: "https://openrouter.ai/api/v1",
          apiKey: options.apiKey,
        })(options.model);
    const model =
      options.middleware && options.middleware.length > 0
        ? wrapLanguageModel({ model: baseModel, middleware: options.middleware })
        : baseModel;

    const result = await generateObject({
      model,
      schema: CompactionSchema,
      system: SUMMARIZATION_PROMPT,
      messages: [{ role: "user", content: conversationText }],
      maxTokens: 2000,
      ...(telemetryConfig ? { experimental_telemetry: telemetryConfig } : {}),
    });

    const obj = result.object;
    if (!obj.summary || obj.summary.trim().length === 0) {
      return {
        messages,
        compacted: false,
        warning: "Compaction produced empty summary — keeping original messages",
      };
    }

    const sections: string[] = [];
    sections.push(`## Summary\n${obj.summary}`);
    if (obj.decisions.length > 0) {
      sections.push(`## Decisions\n${obj.decisions.map((d) => `- ${d}`).join("\n")}`);
    }
    if (obj.filesModified.length > 0) {
      sections.push(`## Files Modified\n${obj.filesModified.map((f) => `- ${f}`).join("\n")}`);
    }
    sections.push(`## Current State\n${obj.currentState}`);
    if (obj.nextSteps.length > 0) {
      sections.push(`## Next Steps\n${obj.nextSteps.map((s) => `- ${s}`).join("\n")}`);
    }

    const summary = sections.join("\n\n");

    const summaryMessage: CoreMessage = {
      role: "user",
      content: `<context_summary>\n${summary}\n</context_summary>`,
    };

    return {
      messages: [summaryMessage, ...tail],
      compacted: true,
    };
  } catch (structuredErr) {
    // Fallback: generateObject() failed — try generateText() with free-text summarization
    try {
      const fallbackBaseModel = options.providers
        ? options.providers.model(options.model)
        : createOpenAICompatible({
            name: "openrouter",
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: options.apiKey,
          })(options.model);
      const fallbackModel =
        options.middleware && options.middleware.length > 0
          ? wrapLanguageModel({ model: fallbackBaseModel, middleware: options.middleware })
          : fallbackBaseModel;

      const result = await generateText({
        model: fallbackModel,
        system: SUMMARIZATION_PROMPT,
        messages: [{ role: "user", content: conversationText }],
        maxTokens: 2000,
        ...(telemetryConfig ? { experimental_telemetry: telemetryConfig } : {}),
      });

      const summary = result.text;
      if (!summary || summary.trim().length === 0) {
        return {
          messages,
          compacted: false,
          warning: "Compaction fallback produced empty summary — keeping original messages",
        };
      }

      const summaryMessage: CoreMessage = {
        role: "user",
        content: `<context_summary>\n${summary}\n</context_summary>`,
      };

      const structuredMsg = structuredErr instanceof Error ? structuredErr.message : String(structuredErr);
      return {
        messages: [summaryMessage, ...tail],
        compacted: true,
        warning: `Structured compaction failed (${structuredMsg}) — used text fallback`,
      };
    } catch (fallbackErr) {
      const structuredMsg = structuredErr instanceof Error ? structuredErr.message : String(structuredErr);
      const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      return {
        messages,
        compacted: false,
        warning: `Compaction failed: structured (${structuredMsg}), fallback (${fallbackMsg}) — keeping original messages`,
      };
    }
  }
}
