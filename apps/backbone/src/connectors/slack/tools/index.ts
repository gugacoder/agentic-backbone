import { createSendSlackMessageTool } from "./send-message.js";

export function createSlackTools(slugs: [string, ...string[]]): Record<string, unknown> {
  return {
    ...createSendSlackMessageTool(slugs),
  };
}
