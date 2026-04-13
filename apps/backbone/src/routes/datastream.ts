import type { AgentEvent } from "../agent/types.js";

/**
 * AI SDK Data Stream Protocol encoder.
 *
 * Format: `${code}:${JSON.stringify(value)}\n`
 *
 * Codes:
 *   0 = text (string)
 *   2 = data (array of JSON values)
 *   3 = error (string)
 *   9 = tool_call ({ toolCallId, toolName, args })
 *   a = tool_result ({ toolCallId, result })
 *   d = finish_message ({ finishReason, usage? })
 *   e = finish_step ({ finishReason, usage?, isContinued? })
 *   f = start_step ({ messageId })
 */

function fmt(code: string, value: unknown): string {
  return `${code}:${JSON.stringify(value)}\n`;
}

export function encodeDataStreamEvent(event: AgentEvent): string | null {
  switch (event.type) {
    case "init":
      // Emit as data array so the client can read sessionId metadata
      return fmt("2", [{ type: "init", sessionId: event.sessionId }]);

    case "text":
      return fmt("0", event.content);

    case "reasoning":
      // AI SDK uses code "g" for reasoning, but not all versions support it.
      // Emit as data for broad compat.
      return fmt("2", [{ type: "reasoning", content: event.content }]);

    case "tool-call":
      return fmt("9", {
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args ?? {},
      });

    case "tool-result":
      return fmt("a", {
        toolCallId: event.toolCallId,
        result: event.result ?? null,
      });

    case "assistant-complete":
      return fmt("e", { finishReason: "stop", isContinued: false });

    case "usage":
      // Emit as data so usage info is available to the client
      return fmt("2", [{
        type: "usage",
        inputTokens: event.usage.inputTokens,
        outputTokens: event.usage.outputTokens,
        totalCostUsd: event.usage.totalCostUsd,
        durationMs: event.usage.durationMs,
      }]);

    case "result":
      // Final finish_message with stop reason
      return fmt("d", { finishReason: "stop" });

    default:
      return null;
  }
}

/**
 * Encodes an error for the Data Stream Protocol.
 */
export function encodeDataStreamError(message: string): string {
  return fmt("3", message);
}
