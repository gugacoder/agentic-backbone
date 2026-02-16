import { tool } from "ai";
import { z } from "zod";
import type { KaiTodoItem } from "../types.js";

// Module-level state: session todos keyed by a simple singleton
// (one agent run = one process = one list)
let currentTodos: KaiTodoItem[] = [];

/** Reset state — useful for testing or when starting a new session */
export function resetTodoState(): void {
  currentTodos = [];
}

/** Read current todos — used internally by TodoRead and available for consumers */
export function getTodos(): KaiTodoItem[] {
  return [...currentTodos];
}

const todoItemSchema = z.object({
  id: z.string().describe("Unique identifier for the todo item"),
  content: z.string().describe("Description of the task"),
  status: z
    .enum(["pending", "in_progress", "completed"])
    .describe("Current status of the task"),
  priority: z
    .enum(["high", "medium", "low"])
    .describe("Priority level of the task"),
});

export const todoWriteTool = tool({
  description:
    "Creates or updates the task list for the current session. Replaces the entire list with the provided todos. Use this to track progress on multi-step tasks.",
  parameters: z.object({
    todos: z
      .array(todoItemSchema)
      .min(1)
      .describe("The complete list of todos (replaces any existing list)"),
  }),
  execute: async ({ todos }) => {
    currentTodos = todos as KaiTodoItem[];

    const pending = currentTodos.filter((t) => t.status === "pending").length;
    const inProgress = currentTodos.filter(
      (t) => t.status === "in_progress"
    ).length;
    const completed = currentTodos.filter(
      (t) => t.status === "completed"
    ).length;

    return `Todo list updated: ${currentTodos.length} items (${completed} completed, ${inProgress} in progress, ${pending} pending)`;
  },
});

export const todoReadTool = tool({
  description:
    "Reads the current task list for the session. Returns all todos with their status and priority.",
  parameters: z.object({}),
  execute: async () => {
    if (currentTodos.length === 0) {
      return "Nenhuma tarefa registrada.";
    }

    const statusIcon: Record<string, string> = {
      pending: "○",
      in_progress: "◐",
      completed: "●",
    };

    const priorityTag: Record<string, string> = {
      high: "[HIGH]",
      medium: "[MED]",
      low: "[LOW]",
    };

    const lines = currentTodos.map(
      (t) =>
        `${statusIcon[t.status]} ${priorityTag[t.priority]} ${t.id}: ${t.content} (${t.status})`
    );

    return lines.join("\n");
  },
});
