import { tool } from "ai";
import { z } from "zod";

/**
 * Callback type for the AskUser tool.
 * The consumer (CLI, API, UI) implements this to present the question
 * to the user and return their answer.
 */
export type AskUserCallback = (
  question: string,
  options?: string[]
) => Promise<string>;

/**
 * Factory that creates the AskUser tool with an injected callback.
 * If no callback is provided, returns a tool that explains no handler is configured.
 */
export function createAskUserTool(onAskUser?: AskUserCallback) {
  return tool({
    description:
      "Ask the user a question during execution. Use this to request clarifications, preferences, or decisions before proceeding. The user will see the question and can respond.",
    parameters: z.object({
      question: z
        .string()
        .describe("The question to ask the user"),
      options: z
        .array(z.string())
        .optional()
        .describe("Optional list of answer choices to present to the user"),
    }),
    execute: async ({ question, options }) => {
      if (!onAskUser) {
        return "AskUser handler not configured. The consuming application must provide an onAskUser callback in AiAgentOptions to enable user interaction.";
      }

      const answer = await onAskUser(question, options);
      return answer;
    },
  });
}
