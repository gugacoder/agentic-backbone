import { createCronStatusTool } from "./cron-status.js";
import { createCronListTool } from "./cron-list.js";
import { createCronAddTool } from "./cron-add.js";
import { createCronUpdateTool } from "./cron-update.js";
import { createCronRemoveTool } from "./cron-remove.js";
import { createCronRunTool } from "./cron-run.js";
import { createCronRunsTool } from "./cron-runs.js";

export function createCronTools(): Record<string, any> {
  return Object.assign(
    {},
    createCronStatusTool(),
    createCronListTool(),
    createCronAddTool(),
    createCronUpdateTool(),
    createCronRemoveTool(),
    createCronRunTool(),
    createCronRunsTool(),
  );
}
