/**
 * Vercel AI SDK tool wrappers for job management.
 * Uses callbacks to avoid coupling to a specific job engine implementation.
 */
import { tool } from "ai";
import { z } from "zod";

export interface JobToolCallbacks {
  submitJob: (opts: {
    agentId: string;
    command: string;
    timeout?: number;
  }) => unknown;
  listJobs: (agentId?: string) => unknown[];
  getJob: (jobId: string) => unknown | undefined;
  killJob: (jobId: string) => boolean;
  getAgentId: () => string | undefined;
}

export function createJobTools(callbacks: JobToolCallbacks) {
  return {
    submit_job: tool({
      description:
        "Submit a long-running process for backbone supervision. The backbone captures output, applies timeout, and wakes you up when the job finishes.",
      parameters: z.object({
        command: z
          .string()
          .describe("Shell command to execute (e.g. 'sleep 30')"),
        timeout: z
          .number()
          .optional()
          .describe("Timeout in seconds. Default: 1800 (30min)"),
      }),
      execute: async ({ command, timeout }) => {
        const agentId = callbacks.getAgentId();
        if (!agentId) return "Error: AGENT_ID not available";
        try {
          const summary = callbacks.submitJob({
            agentId,
            command,
            timeout,
          });
          return JSON.stringify(summary);
        } catch (err) {
          return `Error: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    }),

    list_jobs: tool({
      description:
        "List all jobs for this agent. Returns an array of job summaries.",
      parameters: z.object({}),
      execute: async () => {
        const agentId = callbacks.getAgentId();
        return JSON.stringify(callbacks.listJobs(agentId ?? undefined));
      },
    }),

    get_job: tool({
      description:
        "Get full details of a specific job including output tail, status, exit code, and duration.",
      parameters: z.object({
        jobId: z.string().describe("Job ID to query"),
      }),
      execute: async ({ jobId }) => {
        const job = callbacks.getJob(jobId);
        return job ? JSON.stringify(job) : "Job not found";
      },
    }),

    kill_job: tool({
      description: "Kill a running job with SIGKILL.",
      parameters: z.object({
        jobId: z.string().describe("Job ID to kill"),
      }),
      execute: async ({ jobId }) => {
        return callbacks.killJob(jobId)
          ? "Job killed successfully"
          : "Job not found or already finished";
      },
    }),
  };
}
