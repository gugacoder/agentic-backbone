import type { AiTodoItem } from "../types.js";
/** Reset state — useful for testing or when starting a new session */
export declare function resetTodoState(): void;
/** Read current todos — used internally by TodoRead and available for consumers */
export declare function getTodos(): AiTodoItem[];
export declare const todoWriteTool: import("ai").Tool<{
    todos: {
        status: "pending" | "in_progress" | "completed";
        id: string;
        content: string;
        priority: "high" | "medium" | "low";
    }[];
}, string>;
export declare const todoReadTool: import("ai").Tool<{}, string>;
