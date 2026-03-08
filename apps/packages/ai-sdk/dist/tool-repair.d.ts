import type { LanguageModel } from "ai";
export interface RepairContext {
    model: LanguageModel;
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
export declare function createToolCallRepairHandler(ctx: RepairContext): ({ toolCall, tools, parameterSchema, error, }: {
    toolCall: RepairToolCall;
    tools: Record<string, unknown>;
    parameterSchema: (options: {
        toolName: string;
    }) => unknown;
    error: Error;
}) => Promise<RepairToolCall | null>;
export {};
