import { createMemorySaveTool } from "./memory-save.js";
import { createMemoryJournalTool } from "./memory-journal.js";
import { createMemorySearchTool } from "./memory-search.js";
import { createMemoryUserSaveTool } from "./memory-user-save.js";

export function createMemoryAiTools(agentId: string): Record<string, any> {
  return Object.assign(
    {},
    createMemorySaveTool(agentId),
    createMemoryJournalTool(agentId),
    createMemorySearchTool(agentId),
    createMemoryUserSaveTool(),
  );
}
