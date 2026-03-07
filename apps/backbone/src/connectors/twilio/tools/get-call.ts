import { tool } from "ai";
import { z } from "zod";
import { resolveTwilioConfig } from "./_resolve-config.js";
import { createTwilioClient } from "../client.js";

export function createGetCallTool(): Record<string, any> {
  return {
    get_call: tool({
      description:
        "Consulta o status e detalhes de uma chamada especifica via Twilio. Use quando precisar verificar o estado de uma ligacao pelo SID.",
      parameters: z.object({
        callSid: z
          .string()
          .describe("SID da chamada Twilio (ex: CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)"),
        channelId: z
          .string()
          .optional()
          .describe("Slug do canal twilio-voice (usa o primeiro disponivel se omitido)"),
      }),
      execute: async (args) => {
        let config;
        try {
          config = resolveTwilioConfig(args.channelId);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }

        const client = createTwilioClient(
          { account_sid: config.accountSid, auth_token: config.authToken },
          {},
        );

        try {
          return await client.get(`/Calls/${args.callSid}.json`);
        } catch (err) {
          return { error: `twilio_api_error: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    }),
  };
}
