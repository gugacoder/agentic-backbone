import { generateObject, streamObject } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { z } from "zod";

export interface KaiObjectOptions<T extends z.ZodType> {
  model: string;
  apiKey: string;
  schema: T;
  system?: string;
  prompt: string;
  maxTokens?: number;
}

export async function kaiGenerateObject<T extends z.ZodType>(
  options: KaiObjectOptions<T>
): Promise<z.infer<T>> {
  const openrouter = createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: options.apiKey,
  });

  const result = await generateObject({
    model: openrouter(options.model),
    schema: options.schema,
    system: options.system,
    prompt: options.prompt,
    maxTokens: options.maxTokens,
  });

  return result.object;
}

export async function* kaiStreamObject<T extends z.ZodType>(
  options: KaiObjectOptions<T>
): AsyncGenerator<Partial<z.infer<T>>> {
  const openrouter = createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: options.apiKey,
  });

  const result = streamObject({
    model: openrouter(options.model),
    schema: options.schema,
    system: options.system,
    prompt: options.prompt,
    maxTokens: options.maxTokens,
  });

  for await (const partial of result.partialObjectStream) {
    yield partial;
  }
}
