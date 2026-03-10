import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { submitJob } from "../engine.js";

export function create(): ToolDefinition {
  return {
    name: "submit_job",
    description:
      "Submit a long-running process for backbone supervision. The backbone captures output, applies timeout, and wakes you up when the job finishes. Use this for any process that may take longer than a heartbeat cycle.",
    parameters: z.object({
      command: z.string().describe("Shell command to execute (e.g. 'node path/to/script.mjs')"),
      timeout: z.number().optional().describe("Timeout in seconds. Default: 1800 (30min)"),
    }),
    execute: async (args) => {
      const agentId = process.env.AGENT_ID;
      if (!agentId) return { error: "AGENT_ID not available" };
      try {
        return submitJob({ agentId, command: args.command, timeout: args.timeout });
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
