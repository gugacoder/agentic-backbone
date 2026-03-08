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
}, "strip", z.ZodTypeAny, {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    totalCostUsd: number;
    numTurns: number;
    durationMs: number;
    durationApiMs: number;
    stopReason: string;
}, {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens?: number | undefined;
    cacheCreationInputTokens?: number | undefined;
    totalCostUsd?: number | undefined;
    numTurns?: number | undefined;
    durationMs?: number | undefined;
    durationApiMs?: number | undefined;
    stopReason?: string | undefined;
}>;
export declare const AgentEventSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"init">;
    sessionId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "init";
    sessionId?: string | undefined;
}, {
    type: "init";
    sessionId?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"text">;
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "text";
    content: string;
}, {
    type: "text";
    content: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"step_finish">;
}, "strip", z.ZodTypeAny, {
    type: "step_finish";
}, {
    type: "step_finish";
}>, z.ZodObject<{
    type: z.ZodLiteral<"result">;
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "result";
    content: string;
}, {
    type: "result";
    content: string;
}>, z.ZodObject<{
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
    }, "strip", z.ZodTypeAny, {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens: number;
        cacheCreationInputTokens: number;
        totalCostUsd: number;
        numTurns: number;
        durationMs: number;
        durationApiMs: number;
        stopReason: string;
    }, {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens?: number | undefined;
        cacheCreationInputTokens?: number | undefined;
        totalCostUsd?: number | undefined;
        numTurns?: number | undefined;
        durationMs?: number | undefined;
        durationApiMs?: number | undefined;
        stopReason?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "usage";
    usage: {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens: number;
        cacheCreationInputTokens: number;
        totalCostUsd: number;
        numTurns: number;
        durationMs: number;
        durationApiMs: number;
        stopReason: string;
    };
}, {
    type: "usage";
    usage: {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens?: number | undefined;
        cacheCreationInputTokens?: number | undefined;
        totalCostUsd?: number | undefined;
        numTurns?: number | undefined;
        durationMs?: number | undefined;
        durationApiMs?: number | undefined;
        stopReason?: string | undefined;
    };
}>]>;
export declare const AgentRunOptionsSchema: z.ZodObject<{
    model: z.ZodString;
    apiKey: z.ZodString;
    prompt: z.ZodString;
    sessionId: z.ZodOptional<z.ZodString>;
    sessionDir: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
    tools: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    maxTurns: z.ZodOptional<z.ZodNumber>;
    providerConfig: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    system: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    prompt: string;
    model: string;
    apiKey: string;
    tools?: Record<string, any> | undefined;
    sessionId?: string | undefined;
    sessionDir?: string | undefined;
    role?: string | undefined;
    maxTurns?: number | undefined;
    providerConfig?: Record<string, any> | undefined;
    system?: string | undefined;
}, {
    prompt: string;
    model: string;
    apiKey: string;
    tools?: Record<string, any> | undefined;
    sessionId?: string | undefined;
    sessionDir?: string | undefined;
    role?: string | undefined;
    maxTurns?: number | undefined;
    providerConfig?: Record<string, any> | undefined;
    system?: string | undefined;
}>;
export type AgentEvent = z.infer<typeof AgentEventSchema>;
export type UsageData = z.infer<typeof UsageDataSchema>;
export type AgentRunOptions = z.infer<typeof AgentRunOptionsSchema>;
