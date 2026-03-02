import { tool } from "ai";
import { z } from "zod";
import { submitJob, listJobs, getJob, killJob } from "./engine.js";

export function createJobTools(): Record<string, any> {
  return {
    submit_job: tool({
      description:
        "Submit a long-running process for backbone supervision. The backbone captures output, applies timeout, and wakes you up when the job finishes. Use this for any process that may take longer than a heartbeat cycle.",
      parameters: z.object({
        command: z.string().describe("Shell command to execute (e.g. 'node path/to/script.mjs')"),
        timeout: z.number().optional().describe("Timeout in seconds. Default: 1800 (30min)"),
      }),
      execute: async (args) => {
        const agentId = process.env.AGENT_ID;
        if (!agentId) {
          return { error: "AGENT_ID not available" };
        }
        try {
          return submitJob({
            agentId,
            command: args.command,
            timeout: args.timeout,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { error: msg };
        }
      },
    }),

    list_jobs: tool({
      description:
        "List all jobs for this agent. Returns an array of job summaries with id, status, command, tail output, etc.",
      parameters: z.object({}),
      execute: async () => {
        const agentId = process.env.AGENT_ID;
        return listJobs(agentId ?? undefined);
      },
    }),

    get_job: tool({
      description:
        "Get full details of a specific job including output tail (last 2000 chars), status, exit code, and duration.",
      parameters: z.object({
        jobId: z.string().describe("Job ID to query"),
      }),
      execute: async (args) => {
        const job = getJob(args.jobId);
        if (!job) return { error: "Job not found" };
        return job;
      },
    }),

    kill_job: tool({
      description: "Kill a running job with SIGKILL.",
      parameters: z.object({
        jobId: z.string().describe("Job ID to kill"),
      }),
      execute: async (args) => {
        const killed = killJob(args.jobId);
        return { killed };
      },
    }),
  };
}
