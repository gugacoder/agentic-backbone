import { z } from "zod";
export declare const UsageDataSchema: z.ZodObject<{
    inputTokens: z.ZodNumber;
    outputTokens: z.ZodNumber;
    cacheReadInputTokens: z.ZodDefault<z.ZodNumber>;
    cacheCreationInputTokens: z.ZodDefault<z.ZodNumber>;
    totalCostUsd: z.ZodDefault<z.ZodNumber>;
    numTurns: z.ZodDefault<z.ZodNumber>;
    durationMs: z.ZodDefault<z.ZodNumber>;
    durationApiMs: z.ZodDefault<z.ZodNumber>;
    stopReason: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export declare const AgentEventSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"init">;
    sessionId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"text">;
    content: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"step_finish">;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"result">;
    content: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"usage">;
    usage: z.ZodObject<{
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        cacheReadInputTokens: z.ZodDefault<z.ZodNumber>;
        cacheCreationInputTokens: z.ZodDefault<z.ZodNumber>;
        totalCostUsd: z.ZodDefault<z.ZodNumber>;
        numTurns: z.ZodDefault<z.ZodNumber>;
        durationMs: z.ZodDefault<z.ZodNumber>;
        durationApiMs: z.ZodDefault<z.ZodNumber>;
        stopReason: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"reasoning">;
    content: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"tool-call">;
    toolCallId: z.ZodString;
    toolName: z.ZodString;
    args: z.ZodRecord<z.core.$ZodRecordKey, z.core.SomeType>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"tool-result">;
    toolCallId: z.ZodString;
    toolName: z.ZodString;
    result: z.ZodUnknown;
}, z.core.$strip>], "type">;
export declare const AgentRunOptionsSchema: z.ZodObject<{
    model: z.ZodString;
    apiKey: z.ZodString;
    prompt: z.ZodString;
    sessionId: z.ZodOptional<z.ZodString>;
    sessionDir: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
    tools: z.ZodOptional<z.ZodRecord<z.ZodAny, z.core.SomeType>>;
    maxTurns: z.ZodOptional<z.ZodNumber>;
    providerConfig: z.ZodOptional<z.ZodRecord<z.ZodAny, z.core.SomeType>>;
    system: z.ZodOptional<z.ZodString>;
    messageMeta: z.ZodOptional<z.ZodRecord<z.core.$ZodRecordKey, z.core.SomeType>>;
    provider: z.ZodOptional<z.ZodString>;
    providers: z.ZodOptional<z.ZodRecord<z.core.$ZodRecordKey, z.core.SomeType>>;
    contentParts: z.ZodOptional<z.ZodArray<z.ZodAny>>;
}, z.core.$strip>;
export type AgentEvent = z.infer<typeof AgentEventSchema>;
export type UsageData = z.infer<typeof UsageDataSchema>;
export type AgentRunOptions = z.infer<typeof AgentRunOptionsSchema>;
