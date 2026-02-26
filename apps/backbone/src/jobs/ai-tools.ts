import { tool } from "ai";
import { z } from "zod";
import {
  submitJob,
  listJobs,
  getJob,
  killJob,
  clearJob,
  pollJob,
  logJob,
  writeJob,
} from "./engine.js";

/**
 * Creates Vercel AI SDK tools for job management.
 * Used by the Ai provider path (which cannot use in-process MCP servers).
 */
export function createJobsAiTools(): Record<string, any> {
  return {
    submit_job: tool({
      description:
        "Submit a process for backbone supervision. 3 modes: background=true returns immediately; yieldMs=0 blocks until exit (foreground); default auto-backgrounds after 10s. The backbone captures output, applies timeout, and wakes you up when the job finishes.",
      parameters: z.object({
        command: z.string().describe("Shell command to execute (e.g. 'node path/to/script.mjs')"),
        timeout: z.number().optional().describe("Timeout in seconds. Default: 1800 (30min)"),
        background: z.boolean().optional().describe("If true, return immediately with jobId (explicit background)"),
        yieldMs: z.number().optional().describe("Auto-background after N ms. 0 = pure foreground. Default: 10000"),
        wakeMode: z.enum(["heartbeat", "conversation"]).optional()
          .describe("How to wake the agent when job finishes. Default: heartbeat"),
        wakeContext: z.string().optional()
          .describe("Context to include when waking (agent will see this in <job_context>)"),
      }),
      execute: async (args) => {
        const agentId = process.env.AGENT_ID;
        if (!agentId) return { error: "AGENT_ID not available" };
        return await submitJob({
          agentId,
          command: args.command,
          timeout: args.timeout,
          background: args.background,
          yieldMs: args.yieldMs,
          wakeMode: args.wakeMode,
          wakeContext: args.wakeContext,
          sessionId: process.env.SESSION_ID,
          userId: process.env.USER_ID,
        });
      },
    }),

    list_jobs: tool({
      description: "List all jobs for this agent. Returns an array of job summaries with id, status, command, tail output, etc.",
      parameters: z.object({}),
      execute: async () => {
        const agentId = process.env.AGENT_ID;
        return listJobs(agentId ?? undefined);
      },
    }),

    get_job: tool({
      description: "Get full details of a specific job including output tail (last 2000 chars), status, exit code, and duration.",
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

    clear_job: tool({
      description: "Clear a finished job from memory.",
      parameters: z.object({
        jobId: z.string().describe("Job ID to clear"),
      }),
      execute: async (args) => {
        const cleared = clearJob(args.jobId);
        return { cleared };
      },
    }),

    poll_job: tool({
      description: "Drain pending output since last poll. Returns only new chunks (delta). Use this for incremental monitoring of running jobs.",
      parameters: z.object({
        jobId: z.string().describe("Job ID to poll"),
      }),
      execute: async (args) => {
        const result = pollJob(args.jobId);
        if (!result) return { error: "Job not found" };
        return result;
      },
    }),

    log_job: tool({
      description: "Read the full stdout/stderr log of a job with optional pagination (offset/limit).",
      parameters: z.object({
        jobId: z.string().describe("Job ID to read logs from"),
        offset: z.number().optional().describe("Start offset in chars (default: 0)"),
        limit: z.number().optional().describe("Max chars to return (default: 200000)"),
      }),
      execute: async (args) => {
        const result = logJob(args.jobId, args.offset, args.limit);
        if (!result) return { error: "Job not found" };
        return result;
      },
    }),

    write_job: tool({
      description: "Write data to the stdin of a running job. Useful for interactive processes (e.g. sending input to 'cat', answering prompts).",
      parameters: z.object({
        jobId: z.string().describe("Job ID to write to"),
        data: z.string().describe("Data to write to stdin (include \\n for newlines)"),
      }),
      execute: async (args) => {
        const ok = writeJob(args.jobId, args.data);
        return { ok };
      },
    }),
  };
}
