import { tool } from "ai";
import { z } from "zod";
import { resolveTwilioConfig } from "./_resolve-config.js";
import { createTwilioClient } from "../client.js";

export function createListMessagesTool(): Record<string, any> {
  return {
    list_messages: tool({
      description:
        "Consulta o historico de mensagens SMS/MMS na conta Twilio. Use para verificar mensagens enviadas ou recebidas.",
      parameters: z.object({
        to: z
          .string()
          .optional()
          .describe("Filtrar por numero destino E.164"),
        from: z
          .string()
          .optional()
          .describe("Filtrar por numero origem E.164"),
        dateSentAfter: z
          .string()
          .optional()
          .describe("Data minima ISO 8601 (ex: 2026-03-01T00:00:00Z)"),
        limit: z
          .number()
          .optional()
          .describe("Limite de resultados (default 20, max 100)"),
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

        const params = new URLSearchParams();
        if (args.to) params.append("To", args.to);
        if (args.from) params.append("From", args.from);
        if (args.dateSentAfter) params.append("DateSent>", args.dateSentAfter);
        params.append("PageSize", String(Math.min(args.limit ?? 20, 100)));

        const qs = params.toString();
        const path = `/Messages.json${qs ? `?${qs}` : ""}`;

        try {
          const result = await client.get(path);
          return { messages: result.messages, total: result.messages?.length ?? 0 };
        } catch (err) {
          return { error: `twilio_api_error: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    }),
  };
}
