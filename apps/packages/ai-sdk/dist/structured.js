import { generateText, streamObject, Output } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
export async function aiGenerateObject(options) {
    const model = options.providers
        ? options.providers.model(options.model)
        : createOpenAICompatible({
            name: "openrouter",
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: options.apiKey,
        })(options.model);
    const result = await generateText({
        model,
        output: Output.object({ schema: options.schema }),
        system: options.system,
        prompt: options.prompt,
        maxOutputTokens: options.maxTokens,
    });
    return result.output;
}
export async function* aiStreamObject(options) {
    const model = options.providers
        ? options.providers.model(options.model)
        : createOpenAICompatible({
            name: "openrouter",
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: options.apiKey,
        })(options.model);
    const result = streamObject({
        model,
        schema: options.schema,
        system: options.system,
        prompt: options.prompt,
        maxOutputTokens: options.maxTokens,
    });
    for await (const partial of result.partialObjectStream) {
        yield partial;
    }
}
