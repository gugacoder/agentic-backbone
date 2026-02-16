import { readTool } from "./read.js";
import { writeTool } from "./write.js";
import { editTool } from "./edit.js";
import { bashTool } from "./bash.js";
import { globTool } from "./glob.js";
import { grepTool } from "./grep.js";

export const codingTools = {
  Read: readTool,
  Write: writeTool,
  Edit: editTool,
  Bash: bashTool,
  Glob: globTool,
  Grep: grepTool,
};
