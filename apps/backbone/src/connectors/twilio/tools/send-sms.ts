import { tool } from "ai";
import { z } from "zod";
import { resolveTwilioConfig } from "./_resolve-config.js";
import { createTwilioClient } from "../client.js";

export function createSendSmsTool(): Record<string, any> {
  return {
    send_sms: tool({
      description:
        "Envia um SMS (ou MMS com midia) via Twilio. Use quando precisar enviar uma mensagem de texto para um numero de telefone.",
      parameters: z.object({
        to: z
          .string()
          .describe("Numero destino em formato E.164 (ex: +5532988887777)"),
        body: z
          .string()
          .describe("Texto do SMS a enviar"),
        mediaUrl: z
          .string()
          .optional()
          .describe("URL de midia para enviar como MMS (opcional)"),
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
          const result = await client.sendSms({
            to: args.to,
            from: config.phoneNumber,
            body: args.body,
            mediaUrl: args.mediaUrl,
          });
          return { sid: result.sid, status: result.status, to: result.to, from: result.from };
        } catch (err) {
          return { error: `twilio_api_error: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    }),
  };
}
