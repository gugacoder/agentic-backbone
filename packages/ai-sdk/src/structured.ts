import { generateObject, streamObject } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { z } from "zod";
import type { createAiProviderRegistry } from "./providers.js";

export interface AiObjectOptions<T extends z.ZodType> {
  model: string;
  apiKey: string;
  schema: T;
  system?: string;
  prompt: string;
  maxTokens?: number;
  /** Provider registry para reuso. Se nao fornecido, cria um internamente (backward compat). */
  providers?: ReturnType<typeof createAiProviderRegistry>;
}

export async function aiGenerateObject<T extends z.ZodType>(
  options: AiObjectOptions<T>
): Promise<z.infer<T>> {
  const model = options.providers
    ? options.providers.model(options.model)
    : createOpenAICompatible({
        name: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: options.apiKey,
      })(options.model);

  const result = await generateObject({
    model,
    schema: options.schema,
    system: options.system,
    prompt: options.prompt,
    maxTokens: options.maxTokens,
  });

  return result.object;
}

export async function* aiStreamObject<T extends z.ZodType>(
  options: AiObjectOptions<T>
): AsyncGenerator<Partial<z.infer<T>>> {
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
    maxTokens: options.maxTokens,
  });

  for await (const partial of result.partialObjectStream) {
    yield partial;
  }
}
