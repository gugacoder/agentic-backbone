import { tool } from "ai";
import { z } from "zod";
import { drain } from "./message-queue.js";

/**
 * Creates the `check_messages` tool so the agent can consume queued user
 * messages that arrived while it was processing.
 */
export function createQueueTools(sessionId: string) {
  return {
    check_messages: tool({
      description:
        "Check if the user sent new messages while you were working. " +
        "Call this between major steps to stay responsive to interruptions.",
      parameters: z.object({}),
      execute: async () => {
        const messages = drain(sessionId);
        if (messages.length === 0) return { messages: [] };
        return { messages };
      },
    }),
  };
}
