import type { LanguageModelMiddleware } from "ai";

export function createLoggingMiddleware(
  logger: (msg: string, data?: Record<string, unknown>) => void = console.log
): LanguageModelMiddleware {
  return {
    specificationVersion: "v3" as const,
    transformParams: async (options: any) => {
      const { params } = options;
      const tools =
        params.mode?.type === "regular" ? params.mode.tools?.length ?? 0 : 0;
      logger("[ai:llm] request", {
        tools,
        messages: params.prompt?.length ?? 0,
      });
      return params;
    },
    wrapGenerate: async (options: any) => {
      const { doGenerate } = options;
      const startMs = Date.now();
      const result = await doGenerate();
      logger("[ai:llm] generate", {
        durationMs: Date.now() - startMs,
        finishReason: result.finishReason,
        usage: result.usage,
      });
      return result;
    },
    wrapStream: async (options: any) => {
      const { doStream } = options;
      const startMs = Date.now();
      const result = await doStream();
      logger("[ai:llm] stream started", { durationMs: Date.now() - startMs });
      return result;
    },
  };
}
