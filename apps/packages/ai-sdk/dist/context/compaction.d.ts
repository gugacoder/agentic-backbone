import { type ModelMessage, type LanguageModelMiddleware } from "ai";
import type { AiTelemetryOptions } from "../types.js";
import type { createAiProviderRegistry } from "../providers.js";
export interface CompactOptions {
    model: string;
    apiKey: string;
    contextWindow?: number;
    systemPromptTokens: number;
    toolDefinitionsTokens: number;
    middleware?: LanguageModelMiddleware[];
    telemetry?: AiTelemetryOptions;
    /** Provider registry para reuso. Se nao fornecido, cria um internamente (backward compat). */
    providers?: ReturnType<typeof createAiProviderRegistry>;
}
export interface CompactResult {
    messages: ModelMessage[];
    compacted: boolean;
    warning?: string;
}
/**
 * Compacts conversation messages by summarizing older messages (head)
 * and keeping recent messages (tail) intact.
 *
 * Uses the same model and apiKey as the agent for summarization.
 * If summarization fails, returns original messages with a warning.
 */
export declare function compactMessages(messages: ModelMessage[], options: CompactOptions): Promise<CompactResult>;
