import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { deliverToChannel } from "../system-channel.js";

export function create(): ToolDefinition {
  return {
    name: "emit_to_channel",
    description:
      "Emit a message to a SSE channel. All consumers connected to the channel receive it in real-time. Use this to post updates, alerts, or structured events to channel subscribers (e.g. a Ficha in cia-app).",
    parameters: z.object({
      channel: z.string().describe("Channel slug (e.g. 'cia-app.fichas')"),
      content: z.string().describe("Message content (plain text or JSON string)"),
    }),
    execute: async (args) => {
      const agentId = process.env.AGENT_ID ?? "system.main";
      deliverToChannel(args.channel, agentId, args.content);
      return { status: "delivered", channel: args.channel };
    },
  };
}
