import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { invokeService } from "../engine.js";

export function create(): ToolDefinition {
  return {
    name: "invoke_service",
    description:
      "Invoke a backbone service for fire-and-forget execution. Services are deterministic scripts or LLM calls defined via SERVICE.yaml. Unlike jobs, services never wake the agent — results are delivered via SSE channel or webhook callback. Use this for scripts that don't need agent involvement (SQL queries, PDF generation, API calls, etc.).",
    parameters: z.object({
      slug: z.string().describe("Service slug — resolves SERVICE.yaml from agentic-context (e.g. 'fetch-evolutions', 'generate-report')"),
      input: z.record(z.string(), z.unknown()).optional().describe("JSON input passed to the service handler"),
      timeout: z.number().optional().describe("Timeout in seconds. Default: 300 (5min)"),
      channel: z.string().optional().describe("SSE channel slug to deliver the result to when the service finishes"),
    }),
    execute: async (args) => {
      const agentId = process.env.AGENT_ID;
      try {
        return invokeService({
          slug: args.slug,
          agentId: agentId ?? undefined,
          input: args.input,
          timeout: args.timeout,
          channel: args.channel,
        });
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
