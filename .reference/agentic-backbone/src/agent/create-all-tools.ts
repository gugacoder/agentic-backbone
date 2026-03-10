import { createMemoryTools } from "../memory/tool-defs.js";
import { createAdapterTools } from "../adapters/tool-defs.js";
import { createGroundTruthTools } from "../ground-truth/index.js";
import { createServiceTools } from "../services/tool-defs.js";
import { createChannelTools } from "../channels/tool-defs.js";
import { createToolTools } from "../tools/tool-defs.js";
import { createSkillTools } from "../skills/tool-defs.js";
import type { ToolDefinition } from "./tool-defs.js";

/**
 * Single source of truth for agent tools.
 * Every call site (conversation, heartbeat, cron) uses this identically.
 *
 * jobs/tool-defs and cron/tool-defs are imported lazily to break circular
 * dependency: those modules dynamically import defs that transitively import
 * back into agent/index → create-all-tools, causing a top-level-await deadlock.
 */
export async function createAllTools(agentId: string): Promise<ToolDefinition[]> {
  const [{ createJobTools }, { createCronTools }] = await Promise.all([
    import("../jobs/tool-defs.js"),
    import("../cron/tool-defs.js"),
  ]);

  return [
    ...createMemoryTools(agentId),
    ...createAdapterTools(agentId),
    ...(await createGroundTruthTools(agentId)),
    ...createJobTools(),
    ...createCronTools(),
    ...createServiceTools(),
    ...createChannelTools(),
    ...createToolTools(agentId),
    ...createSkillTools(agentId),
  ];
}
