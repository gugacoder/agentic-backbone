import { generateText, type CoreMessage } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { countTokens } from "./tokenizer.js";
import { getContextWindow } from "./models.js";

const TAIL_RATIO = 0.30;

const SUMMARIZATION_PROMPT = `Summarize the conversation below preserving: decisions made, files modified, current state of work, and next steps. Be concise.`;

export interface CompactOptions {
  model: string;
  apiKey: string;
  contextWindow?: number;
  systemPromptTokens: number;
  toolDefinitionsTokens: number;
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

  try {
    const openrouter = createOpenAICompatible({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: options.apiKey,
    });

    const result = await generateText({
      model: openrouter(options.model),
      system: SUMMARIZATION_PROMPT,
      messages: [{ role: "user", content: conversationText }],
      maxTokens: 2000,
    });

    const summary = result.text;
    if (!summary || summary.trim().length === 0) {
      return {
        messages,
        compacted: false,
        warning: "Compaction produced empty summary — keeping original messages",
      };
    }

    const summaryMessage: CoreMessage = {
      role: "user",
      content: `<context_summary>\n${summary}\n</context_summary>`,
    };

    return {
      messages: [summaryMessage, ...tail],
      compacted: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      messages,
      compacted: false,
      warning: `Compaction failed: ${msg} — continuing with original messages`,
    };
  }
}
