import type { AgentEvent } from "../agent/types.js";

/**
 * Traduz AgentEvent para o protocolo Vercel AI SDK DataStream.
 * Retorna string formatada com prefixo ou null se o evento nao tem representacao.
 *
 * Prefixos DataStream:
 *   0: — text delta
 *   9: — tool call
 *   a: — tool result
 *   e: — step finish (finish reason)
 *   d: — done (usage + finish reason)
 *   g: — reasoning
 */
/**
 * Codifica uma mensagem de erro no protocolo DataStream (prefixo 3:).
 * O @ai-sdk/react useChat interpreta isso como erro e popula o state `error`.
 */
export function encodeDataStreamError(message: string): string {
  return `3:${JSON.stringify(message)}`;
}

export function encodeDataStreamEvent(event: AgentEvent): string | null {
  try {
    switch (event.type) {
      case "text":
        return `0:${JSON.stringify(event.content)}`;
      case "reasoning":
        return `g:${JSON.stringify(event.content)}`;
      case "tool-call":
        return `9:${JSON.stringify({
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args ?? {},
        })}`;
      case "tool-result":
        return `a:${JSON.stringify({
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          result: event.result ?? null,
        })}`;
      case "step_finish":
        return `e:${JSON.stringify({ finishReason: "stop" })}`;
      case "usage":
        return `d:${JSON.stringify({
          finishReason: "stop",
          usage: {
            promptTokens: event.usage.inputTokens,
            completionTokens: event.usage.outputTokens,
          },
        })}`;
      case "init":
        return null;
      case "result":
        return null;
      default:
        return null;
    }
  } catch (err) {
    console.error(`[datastream] failed to encode event type="${(event as any)?.type}":`, err);
    return null;
  }
}
