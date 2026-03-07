import { tool } from "ai";
import { z } from "zod";
import { resolveTwilioConfig } from "./_resolve-config.js";
import { createTwilioClient } from "../client.js";
import { removeCall } from "../calls.js";

export function createHangupCallTool(): Record<string, any> {
  return {
    hangup_call: tool({
      description:
        "Desliga uma chamada telefonica ativa via Twilio. Use quando precisar encerrar uma ligacao em andamento.",
      parameters: z.object({
        callSid: z
          .string()
          .describe("SID da chamada Twilio a encerrar (ex: CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)"),
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
          await client.updateCall(args.callSid, { Status: "completed" });
          removeCall(args.callSid);
          return { callSid: args.callSid, status: "completed" };
        } catch (err) {
          return { error: `twilio_api_error: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    }),
  };
}
