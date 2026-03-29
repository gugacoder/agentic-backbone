import type { LanguageModel } from "ai";
import type { LanguageModelV3ToolCall } from "@ai-sdk/provider";
export interface RepairContext {
    model: LanguageModel;
    maxAttempts: number;
}
/**
 * Cria um handler de reparo que pede ao modelo para corrigir a tool call.
 * Primeiro tenta corrigir o nome da tool (case mismatch), depois os args.
 * Tenta N vezes. Se todas falharem, retorna null (deixa o erro original propagar).
 */
export declare function createToolCallRepairHandler(ctx: RepairContext): (options: {
    toolCall: LanguageModelV3ToolCall;
    tools: Record<string, unknown>;
    inputSchema: (opts: {
        toolName: string;
    }) => unknown;
    error: Error;
    system?: unknown;
    messages?: unknown;
}) => Promise<LanguageModelV3ToolCall | null>;
