import { readTool } from "./read.js";
import { writeTool } from "./write.js";
import { editTool } from "./edit.js";
import { bashTool } from "./bash.js";
import { globTool } from "./glob.js";
import { grepTool } from "./grep.js";
import { listDirTool } from "./list-dir.js";
import { multiEditTool } from "./multi-edit.js";
import { todoWriteTool, todoReadTool } from "./todo.js";
import { diagnosticsTool } from "./diagnostics.js";
import { createAskUserTool } from "./ask-user.js";
import { webFetchTool } from "./web-fetch.js";
import { createWebSearchTool } from "./web-search.js";

export const codingTools = {
  Read: readTool,
  Write: writeTool,
  Edit: editTool,
  Bash: bashTool,
  Glob: globTool,
  Grep: grepTool,
  ListDir: listDirTool,
  MultiEdit: multiEditTool,
  TodoWrite: todoWriteTool,
  TodoRead: todoReadTool,
  Diagnostics: diagnosticsTool,
  AskUser: createAskUserTool(),
  WebFetch: webFetchTool,
  WebSearch: createWebSearchTool(),
};
