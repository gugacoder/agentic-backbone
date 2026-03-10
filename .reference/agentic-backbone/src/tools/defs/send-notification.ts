/**
 * send_notification — wrapper para o filesystem loader.
 *
 * Adapta a implementacao em send-notification/tool.ts para o
 * padrao de flat file esperado pelo filesystem loader em tool-defs.ts.
 * Exporta create(_agentId) => ToolDefinition.
 */

import { sendNotificationTool } from "./send-notification/tool.js";
import type { ToolDefinition } from "../../agent/tool-defs.js";

export function create(_agentId: string): ToolDefinition {
  return sendNotificationTool;
}
