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
export declare function aiGenerateObject<T extends z.ZodType>(options: AiObjectOptions<T>): Promise<z.infer<T>>;
export declare function aiStreamObject<T extends z.ZodType>(options: AiObjectOptions<T>): AsyncGenerator<Partial<z.infer<T>>>;
