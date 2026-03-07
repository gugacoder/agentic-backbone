import { createSubmitJobTool } from "./submit-job.js";
import { createListJobsTool } from "./list-jobs.js";
import { createGetJobTool } from "./get-job.js";
import { createKillJobTool } from "./kill-job.js";
import { createClearJobTool } from "./clear-job.js";
import { createPollJobTool } from "./poll-job.js";
import { createLogJobTool } from "./log-job.js";
import { createWriteJobTool } from "./write-job.js";

export function createJobTools(): Record<string, any> {
  return Object.assign(
    {},
    createSubmitJobTool(),
    createListJobsTool(),
    createGetJobTool(),
    createKillJobTool(),
    createClearJobTool(),
    createPollJobTool(),
    createLogJobTool(),
    createWriteJobTool(),
  );
}
