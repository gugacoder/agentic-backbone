import type { LanguageModelMiddleware } from "ai";
export declare function createLoggingMiddleware(logger?: (msg: string, data?: Record<string, unknown>) => void): LanguageModelMiddleware;
