import { createSdkMcpServer, tool as sdkTool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// Workaround: SDK expects zod v4 types but backbone uses zod v3.
const tool = sdkTool as (
  name: string,
  description: string,
  inputSchema: Record<string, any>,
  handler: (args: any, extra: unknown) => Promise<any>,
  extras?: any,
) => ReturnType<typeof sdkTool>;
import { submitJob, listJobs, getJob, killJob } from "./engine.js";

export const jobsMcpServer = createSdkMcpServer({
  name: "backbone-jobs",
  version: "1.0.0",
  tools: [
    tool(
      "submit_job",
      "Submit a long-running process for backbone supervision. The backbone captures output, applies timeout, and wakes you up when the job finishes. Use this for any process that may take longer than a heartbeat cycle.",
      {
        command: z.string().describe("Shell command to execute (e.g. 'node path/to/script.mjs')"),
        timeout: z.number().optional().describe("Timeout in seconds. Default: 1800 (30min)"),
      },
      async (args) => {
        const agentId = process.env.AGENT_ID;
        if (!agentId) {
          return { content: [{ type: "text" as const, text: "Error: AGENT_ID not available" }] };
        }
        try {
          const summary = submitJob({
            agentId,
            command: args.command,
            timeout: args.timeout,
          });
          return { content: [{ type: "text" as const, text: JSON.stringify(summary) }] };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { content: [{ type: "text" as const, text: `Error: ${msg}` }] };
        }
      }
    ),

    tool(
      "list_jobs",
      "List all jobs for this agent. Returns an array of job summaries with id, status, command, tail output, etc.",
      {},
      async () => {
        const agentId = process.env.AGENT_ID;
        const jobs = listJobs(agentId ?? undefined);
        return { content: [{ type: "text" as const, text: JSON.stringify(jobs) }] };
      }
    ),

    tool(
      "get_job",
      "Get full details of a specific job including output tail (last 2000 chars), status, exit code, and duration.",
      {
        jobId: z.string().describe("Job ID to query"),
      },
      async (args) => {
        const job = getJob(args.jobId);
        if (!job) {
          return { content: [{ type: "text" as const, text: "Job not found" }] };
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(job) }] };
      }
    ),

    tool(
      "kill_job",
      "Kill a running job with SIGKILL.",
      {
        jobId: z.string().describe("Job ID to kill"),
      },
      async (args) => {
        const killed = killJob(args.jobId);
        return {
          content: [{
            type: "text" as const,
            text: killed ? "Job killed successfully" : "Job not found or already finished",
          }],
        };
      }
    ),
  ],
});
