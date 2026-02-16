import { resolveTools } from "../context/resolver.js";
import type { ResolvedResource } from "../context/resolver.js";

export function loadAgentTools(agentId: string): ResolvedResource[] {
  return [...resolveTools(agentId).values()];
}
