import { readTool } from "./read.js";
import { writeTool, createWriteTool } from "./write.js";
import { editTool, createEditTool } from "./edit.js";
import { bashTool, createBashTool } from "./bash.js";
import { globTool } from "./glob.js";
import { grepTool } from "./grep.js";
import { listDirTool } from "./list-dir.js";
import { multiEditTool, createMultiEditTool } from "./multi-edit.js";
import { todoWriteTool, todoReadTool } from "./todo.js";
import { diagnosticsTool } from "./diagnostics.js";
import { createAskUserTool } from "./ask-user.js";
import { webFetchTool } from "./web-fetch.js";
import { createWebSearchTool } from "./web-search.js";
import { createTaskTool } from "./task.js";
import { createBatchTool } from "./batch.js";
import { applyPatchTool, createApplyPatchTool } from "./apply-patch.js";
import { createCodeSearchTool } from "./code-search.js";
import { httpRequestTool } from "./http-request.js";
import { apiSpecTool } from "./api-spec.js";

export { createBashTool } from "./bash.js";
export { createWriteTool } from "./write.js";
export { createEditTool } from "./edit.js";
export { createMultiEditTool } from "./multi-edit.js";
export { createApplyPatchTool } from "./apply-patch.js";

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
  Task: createTaskTool(),
  Batch: createBatchTool({}),
  ApplyPatch: applyPatchTool,
  CodeSearch: createCodeSearchTool(),
  HttpRequest: httpRequestTool,
  ApiSpec: apiSpecTool,
};
