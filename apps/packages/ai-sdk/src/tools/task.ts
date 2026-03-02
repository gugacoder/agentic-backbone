import { tool } from "ai";
import { z } from "zod";

const MAX_OUTPUT = 50_000;

/**
 * Configuration for spawning a sub-agent via the Task tool.
 * Inherits model/apiKey from the parent agent.
 */
export interface TaskConfig {
  model: string;
  apiKey: string;
  /** Maximum steps the sub-agent can take (default: 10) */
  maxSubSteps?: number;
}

/**
 * Factory that creates the Task tool for launching sub-agents.
 *
 * If no config is provided, returns a tool that explains it's not configured.
 * When configured, uses runAiAgent() internally to spawn an isolated sub-agent
 * that inherits the parent's model and apiKey but has no access to conversation history.
 */
export function createTaskTool(config?: TaskConfig) {
  return tool({
    description:
      "Launch a sub-agent to handle a task autonomously. The sub-agent receives the same coding tools but runs in an isolated session without access to the parent's conversation history. Use this for tasks that can be completed independently.",
    inputSchema: z.object({
      description: z
        .string()
        .describe("Short description of the task (3-5 words)"),
      prompt: z
        .string()
        .describe("Detailed instructions for the sub-agent to execute"),
    }),
    execute: async ({ description, prompt }) => {
      if (!config) {
        return "Task tool not configured. The consuming application must provide model and apiKey configuration to enable sub-agent spawning.";
      }

      try {
        // Dynamic import to avoid circular dependency at module load time
        const { runAiAgent } = await import("../agent.js");

        let resultText = "";

        const generator = runAiAgent(prompt, {
          model: config.model,
          apiKey: config.apiKey,
          maxSteps: config.maxSubSteps ?? 10,
        });

        for await (const event of generator) {
          if (event.type === "result") {
            resultText = event.content;
          }
        }

        let output = `## Sub-agent result for: "${description}"\n\n${resultText}`;

        if (output.length > MAX_OUTPUT) {
          output = output.slice(0, MAX_OUTPUT) + "\n...[truncated at 50KB]";
        }

        return output;
      } catch (err: any) {
        return `Error running sub-agent "${description}": ${err.message}`;
      }
    },
  });
}
