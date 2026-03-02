import type { AgentEvent, AgentRunOptions } from "../schemas.js";

export interface ProxyAdapter {
  run(options: AgentRunOptions): AsyncGenerator<AgentEvent>;
}
