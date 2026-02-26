import { generateText } from "ai";
import type { LanguageModelV1 } from "ai";

export interface RepairContext {
  model: LanguageModelV1;
  maxAttempts: number;
}

interface RepairToolCall {
  toolCallType: "function";
  toolCallId: string;
  toolName: string;
  args: string;
}

/**
 * Cria um handler de reparo que pede ao modelo para corrigir a tool call.
 * Tenta N vezes. Se todas falharem, retorna null (deixa o erro original propagar).
 */
export function createToolCallRepairHandler(ctx: RepairContext) {
  const attempts = new Map<string, number>();

  return async ({
    toolCall,
    tools,
    parameterSchema,
    error,
  }: {
    toolCall: RepairToolCall;
    tools: Record<string, unknown>;
    parameterSchema: (options: { toolName: string }) => unknown;
    error: Error;
  }): Promise<RepairToolCall | null> => {
    const key = `${toolCall.toolName}:${toolCall.args}`;
    const current = attempts.get(key) ?? 0;

    if (current >= ctx.maxAttempts) {
      return null; // desiste — erro original propaga
    }
    attempts.set(key, current + 1);

    try {
      const schema = parameterSchema({ toolName: toolCall.toolName });

      const result = await generateText({
        model: ctx.model,
        system: [
          "You generated an invalid tool call. Fix the JSON arguments to match the schema.",
          "Return ONLY the corrected JSON object — no explanation, no markdown.",
        ].join("\n"),
        prompt: [
          `Tool: ${toolCall.toolName}`,
          `Schema: ${JSON.stringify(schema)}`,
          `Invalid args: ${toolCall.args}`,
          `Error: ${error.message}`,
        ].join("\n"),
        maxTokens: 1000,
      });

      const repaired = result.text.trim();
      return {
        toolCallType: toolCall.toolCallType,
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        args: repaired,
      };
    } catch {
      return null; // reparo falhou — erro original propaga
    }
  };
}
