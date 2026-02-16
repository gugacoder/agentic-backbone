import { runKaiAgent } from "@agentic-backbone/kai-sdk";
import { resolveModel } from "../../settings/llm.js";
import type { AgentEvent } from "../types.js";
import type { AgentProvider, AgentProviderOptions } from "./types.js";
import { join } from "node:path";

export function createKaiProvider(): AgentProvider {
  return {
    async *run(
      prompt: string,
      options?: AgentProviderOptions
    ): AsyncGenerator<AgentEvent> {
      const role = options?.role ?? "conversation";
      const model = resolveModel(role);
      const apiKey = process.env.OPENROUTER_API_KEY;

      if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY is required for the Kai provider");
      }

      console.log(`[kai] role=${role} model=${model}`);

      const sessionDir = join(process.cwd(), "data", "kai-sessions");

      for await (const event of runKaiAgent(prompt, {
        model,
        apiKey,
        sessionId: options?.sdkSessionId,
        sessionDir,
        maxSteps: 30,
      })) {
        // KaiAgentEvent maps 1:1 to AgentEvent
        yield event as AgentEvent;
      }
    },
  };
}
