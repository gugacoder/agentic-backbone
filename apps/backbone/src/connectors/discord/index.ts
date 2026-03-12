import type { ConnectorDef } from "../types.js";
import { credentialSchema, optionsSchema } from "./schemas.js";
import { createDiscordClient } from "./client.js";
import { createDiscordSendMessageTool } from "./tools/send-message.js";
import { createDiscordGetMessagesTool } from "./tools/get-messages.js";
import { createDiscordListChannelsTool } from "./tools/list-channels.js";

export const discordConnector: ConnectorDef = {
  slug: "discord",
  credentialSchema,
  optionsSchema,
  createClient(credential, options) {
    return createDiscordClient(
      credentialSchema.parse(credential),
      optionsSchema.parse(options),
    );
  },
  createTools(adapters) {
    if (adapters.length === 0) return null;
    return {
      ...createDiscordSendMessageTool(adapters),
      ...createDiscordGetMessagesTool(adapters),
      ...createDiscordListChannelsTool(adapters),
    };
  },
};
