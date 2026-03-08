import { createSendTeamsMessageTool } from "./send-message.js";

export function createTeamsTools(slugs: [string, ...string[]]): Record<string, unknown> {
  return {
    ...createSendTeamsMessageTool(slugs),
  };
}
