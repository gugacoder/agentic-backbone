import type { LanguageModelV1Middleware } from "ai";
export declare function createLoggingMiddleware(logger?: (msg: string, data?: Record<string, unknown>) => void): LanguageModelV1Middleware;
