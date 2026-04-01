import { tool } from "ai";
import { z } from "zod";
import { resolveTwilioConfig } from "./_resolve-config.js";
import { formatError } from "../../../utils/errors.js";

export function createLookupNumberTool(): Record<string, any> {
  return {
    lookup_number: tool({
      description:
        "Consulta informacoes sobre um numero de telefone via Twilio Lookup API. Retorna tipo de linha (mobile/landline/voip), carrier e pais.",
      parameters: z.object({
        number: z
          .string()
          .describe("Numero em formato E.164 a consultar (ex: +5532988887777)"),
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
          return { error: formatError(err) };
        }

        const authHeader =
          "Basic " + Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");

        const encoded = encodeURIComponent(args.number);
        const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encoded}`;

        try {
          const res = await fetch(url, {
            headers: { Authorization: authHeader },
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
            return { error: "twilio_lookup_error", details: err };
          }
          return await res.json();
        } catch (err) {
          return { error: `twilio_network_error: ${formatError(err)}` };
        }
      },
    }),
  };
}
