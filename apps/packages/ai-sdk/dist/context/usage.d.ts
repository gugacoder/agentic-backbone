import type { ModelMessage } from "ai";
import type { ContextUsage } from "../types.js";
export interface GetContextUsageOptions {
    model: string;
    systemPrompt: string;
    toolDefinitions: Record<string, unknown>;
    messages: ModelMessage[];
    contextWindow?: number;
    compactThreshold?: number;
}
export declare function getContextUsage(options: GetContextUsageOptions): ContextUsage;
