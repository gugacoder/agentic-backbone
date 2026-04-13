import type { AiTodoItem } from "../types.js";
/** Reset state — useful for testing or when starting a new session */
export declare function resetTodoState(): void;
/** Read current todos — used internally by TodoRead and available for consumers */
export declare function getTodos(): AiTodoItem[];
export declare const todoWriteTool: any;
export declare const todoReadTool: any;
