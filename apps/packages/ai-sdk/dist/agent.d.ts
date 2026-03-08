import type { AiAgentEvent, AiAgentOptions } from "./types.js";
export declare function runAiAgent(prompt: string, options: AiAgentOptions): AsyncGenerator<AiAgentEvent>;
