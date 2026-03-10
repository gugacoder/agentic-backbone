import type { ToolDefinition } from "../agent/tool-defs.js";
import { loadDropInTools } from "./dropin-loader.js";

export async function createGroundTruthTools(agentId: string): Promise<ToolDefinition[]> {
  return loadDropInTools(agentId);
}
