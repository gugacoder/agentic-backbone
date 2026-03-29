/**
 * Callback type for the AskUser tool.
 * The consumer (CLI, API, UI) implements this to present the question
 * to the user and return their answer.
 */
export type AskUserCallback = (question: string, options?: string[]) => Promise<string>;
/**
 * Factory that creates the AskUser tool with an injected callback.
 * If no callback is provided, returns a tool that explains no handler is configured.
 */
export declare function createAskUserTool(onAskUser?: AskUserCallback): import("ai").Tool<{
    question: string;
    options?: string[] | undefined;
}, string>;
