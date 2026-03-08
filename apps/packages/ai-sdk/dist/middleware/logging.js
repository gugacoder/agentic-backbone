export function createLoggingMiddleware(logger = console.log) {
    return {
        transformParams: async ({ params }) => {
            const tools = params.mode.type === "regular" ? params.mode.tools?.length ?? 0 : 0;
            logger("[ai:llm] request", {
                tools,
                messages: params.prompt.length,
            });
            return params;
        },
        wrapGenerate: async ({ doGenerate }) => {
            const startMs = Date.now();
            const result = await doGenerate();
            logger("[ai:llm] generate", {
                durationMs: Date.now() - startMs,
                finishReason: result.finishReason,
                usage: result.usage,
            });
            return result;
        },
        wrapStream: async ({ doStream }) => {
            const startMs = Date.now();
            const result = await doStream();
            logger("[ai:llm] stream started", { durationMs: Date.now() - startMs });
            return result;
        },
    };
}
