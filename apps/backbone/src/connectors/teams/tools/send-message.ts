import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { credentialSchema, optionsSchema } from "../schemas.js";
import { createTeamsClient } from "../client.js";

export function createSendTeamsMessageTool(slugs: [string, ...string[]]) {
  return {
    send_teams_message: tool({
      description: "Envia uma mensagem para um canal do Microsoft Teams via Incoming Webhook.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Slug do adapter teams a usar"),
        text: z.string().describe("Texto da mensagem"),
        title: z.string().optional().describe("Título opcional da mensagem"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapter = connectorRegistry.findAdapter(args.instance);
          if (!adapter) throw new Error(`Adapter "${args.instance}" not found`);

          const cred = credentialSchema.parse(adapter.credential);
          const optsResult = optionsSchema.safeParse(adapter.options);
          const opts = optsResult.success ? optsResult.data : { adaptive_cards: false };

          const client = createTeamsClient(cred, opts);
          return await client.sendMessage(args.text, args.title);
        } catch (err) {
          return { ok: false, error: formatError(err) };
        }
      },
    }),
  };
}
