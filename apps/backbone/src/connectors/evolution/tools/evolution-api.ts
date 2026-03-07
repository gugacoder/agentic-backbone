import { tool } from "ai";
import { z } from "zod";

export function createEvolutionApiTool(slugs: [string, ...string[]]): Record<string, any> {
  return {
    whatsapp_api_raw: tool({
      description: "Chamada HTTP generica a Evolution API. Use APENAS para operacoes nao cobertas pelas tools especificas do WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Evolution adapter slug"),
        method: z.enum(["GET", "POST"]).describe("HTTP method"),
        endpoint: z.string().describe("API endpoint path (e.g. /message/sendText/instance)"),
        body: z.string().optional().describe("JSON body for POST requests"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapter = connectorRegistry.createClient(args.instance);
          let result: unknown;
          if (args.method === "GET") {
            result = await adapter.get(args.endpoint);
          } else {
            const body = args.body ? JSON.parse(args.body) : undefined;
            result = await adapter.send(args.endpoint, body);
          }
          return result;
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
