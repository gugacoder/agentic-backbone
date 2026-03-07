import { tool } from "ai";
import { z } from "zod";
import { resolveTwilioConfig } from "./_resolve-config.js";
import { createTwilioClient } from "../client.js";

export function createListCallsTool(): Record<string, any> {
  return {
    list_calls: tool({
      description:
        "Consulta o historico de chamadas telefonicas na conta Twilio. Use para verificar chamadas recentes, filtrar por status ou numero.",
      parameters: z.object({
        status: z
          .enum(["queued", "ringing", "in-progress", "completed", "busy", "no-answer", "canceled", "failed"])
          .optional()
          .describe("Filtrar por status da chamada"),
        to: z
          .string()
          .optional()
          .describe("Filtrar por numero destino E.164"),
        from: z
          .string()
          .optional()
          .describe("Filtrar por numero origem E.164"),
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
        if (args.status) params.append("Status", args.status);
        if (args.to) params.append("To", args.to);
        if (args.from) params.append("From", args.from);
        params.append("PageSize", String(Math.min(args.limit ?? 20, 100)));

        const qs = params.toString();
        const path = `/Calls.json${qs ? `?${qs}` : ""}`;

        try {
          const result = await client.get(path);
          return { calls: result.calls, total: result.calls?.length ?? 0 };
        } catch (err) {
          return { error: `twilio_api_error: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    }),
  };
}
