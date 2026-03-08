import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
const DEFAULT_ALIASES = {
    "fast": "anthropic/claude-haiku-4.5",
    "balanced": "anthropic/claude-sonnet-4",
    "strong": "anthropic/claude-opus-4.6",
};
export function createAiProviderRegistry(config) {
    const openrouter = createOpenAICompatible({
        name: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: config.apiKey,
    });
    const aliases = { ...DEFAULT_ALIASES, ...config.aliases };
    return {
        /** Resolve modelo por ID ou alias */
        model(nameOrAlias) {
            const resolved = aliases[nameOrAlias] ?? nameOrAlias;
            return openrouter(resolved);
        },
        /** Aliases registrados */
        aliases,
    };
}
