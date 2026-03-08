import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { credentialSchema } from "../schemas.js";
import { createSlackClient } from "../client.js";

export function createSendSlackMessageTool(slugs: [string, ...string[]]) {
  return {
    send_slack_message: tool({
      description: "Envia uma mensagem para um canal do Slack.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Slug do adapter slack a usar"),
        channel: z.string().describe("ID ou nome do canal Slack (ex: C01234567 ou #general)"),
        text: z.string().describe("Texto da mensagem"),
        thread_ts: z
          .string()
          .optional()
          .describe("Timestamp da mensagem pai para responder em thread"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapter = connectorRegistry.findAdapter(args.instance);
          if (!adapter) throw new Error(`Adapter "${args.instance}" not found`);

          const cred = credentialSchema.parse(adapter.credential);
          const client = createSlackClient(cred);
          const result = await client.postMessage(args.channel, args.text, args.thread_ts);
          return result;
        } catch (err) {
          return { ok: false, ts: "", error: formatError(err) };
        }
      },
    }),
  };
}
