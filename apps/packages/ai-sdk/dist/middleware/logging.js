export function createLoggingMiddleware(logger = console.log) {
    return {
        specificationVersion: "v3",
        transformParams: async (options) => {
            const { params } = options;
            const tools = params.mode?.type === "regular" ? params.mode.tools?.length ?? 0 : 0;
            logger("[ai:llm] request", {
                tools,
                messages: params.prompt?.length ?? 0,
            });
            return params;
        },
        wrapGenerate: async (options) => {
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
        wrapStream: async (options) => {
            const { doStream } = options;
            const startMs = Date.now();
            const result = await doStream();
            logger("[ai:llm] stream started", { durationMs: Date.now() - startMs });
            return result;
        },
    };
}
