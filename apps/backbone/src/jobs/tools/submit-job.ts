import { tool } from "ai";
import { z } from "zod";
import { submitJob } from "../engine.js";

export function createSubmitJobTool(): Record<string, any> {
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
        if (!agentId) {
          return { error: "AGENT_ID not available" };
        }
        try {
          return submitJob({
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
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { error: msg };
        }
      },
    }),
  };
}
