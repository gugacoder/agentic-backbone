import { tool } from "ai";
import { z } from "zod";
import { deliverToChannel } from "../../channels/system-channel.js";
import { formatError } from "../../utils/errors.js";

export function createEmitTool(agentId: string): Record<string, any> {
  return {
    emit_event: tool({
      description:
        "Emit a message to a channel. Use this to proactively deliver content to a specific channel by its ID.",
      parameters: z.object({
        channel: z.string().describe("Channel ID to deliver the message to"),
        content: z.string().describe("Message content to deliver"),
      }),
      execute: async (args) => {
        try {
          await deliverToChannel(args.channel, agentId, args.content);
          return { emitted: true, channel: args.channel };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
