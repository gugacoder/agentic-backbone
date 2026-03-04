import { tool } from "ai";
import { z } from "zod";
import { listChannels } from "./registry.js";
import { deliverToChannel } from "./system-channel.js";
import { getAgent } from "../agents/registry.js";

interface MessageToolOptions {
  recipientId?: string;
}

/**
 * Creates the `send_message` tool for agents to proactively deliver messages to channels.
 * Filters channels by agent owner. Returns null if no channels are accessible.
 *
 * When `recipientId` is provided, passes it as metadata so that channel adapters
 * (e.g. WhatsApp/Evolution) know which user to deliver to.
 */
export function createMessageTools(agentId: string, opts?: MessageToolOptions): Record<string, any> | null {
  const agent = getAgent(agentId);
  if (!agent) return null;

  const channels = listChannels().filter((ch) => ch.owner === agent.owner);
  if (channels.length === 0) return null;

  const slugs = channels.map((ch) => ch.slug) as [string, ...string[]];
  const channelList = channels
    .map((ch) => `- ${ch.slug}: ${ch.type}${ch.description ? ` — ${ch.description}` : ""}`)
    .join("\n");

  return {
    send_message: tool({
      description:
        `Send a message to one of the user's channels. Available channels:\n${channelList}`,
      parameters: z.object({
        channel: z.enum(slugs).describe("Channel slug to send the message to"),
        message: z.string().describe("Message content to deliver"),
      }),
      execute: async (args) => {
        try {
          await deliverToChannel(args.channel, agentId, args.message, {
            metadata: opts?.recipientId ? { recipientId: opts.recipientId } : undefined,
          });
          return { sent: true, channel: args.channel };
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
