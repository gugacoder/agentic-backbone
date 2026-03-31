import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

const connectionStateParams = z.object({
  action: z.literal("connection_state"),
});

const listInstancesParams = z.object({
  action: z.literal("list_instances"),
});

const listLabelsParams = z.object({
  action: z.literal("list_labels"),
});

const handleLabelParams = z.object({
  action: z.literal("handle_label"),
  number: z.string().describe("Numero do contato no formato internacional sem + (ex: 5532988887777)"),
  labelId: z.string().describe("ID da label a aplicar ou remover"),
  label_action: z.enum(["add", "remove"]).describe("Acao: add (adicionar label) ou remove (remover label)"),
});

const apiRawParams = z.object({
  action: z.literal("api_raw"),
  method: z.enum(["GET", "POST"]).describe("HTTP method"),
  endpoint: z.string().describe("API endpoint path (e.g. /message/sendText/instance)"),
  body: z.string().optional().describe("JSON body for POST requests"),
});

const paramsSchema = z.discriminatedUnion("action", [
  connectionStateParams,
  listInstancesParams,
  listLabelsParams,
  handleLabelParams,
  apiRawParams,
]);

export function createWhatsappAdminTool(slugs: [string, ...string[]]): Record<string, any> {
  const defaultSlug = slugs[0];

  return {
    whatsapp_admin: tool({
      description: [
        "Administracao e operacoes de baixo nivel da Evolution API (WhatsApp).",
        "Acoes: connection_state, list_instances, list_labels, handle_label, api_raw.",
        "Use api_raw para operacoes nao cobertas pelas outras tools do WhatsApp.",
      ].join(" "),
      parameters: paramsSchema.and(z.object({
        instance: z.enum(slugs).optional().describe("Instancia do WhatsApp a usar"),
      })),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const instance = args.instance ?? defaultSlug;
          const client = connectorRegistry.createClient(instance);

          switch (args.action) {
            case "connection_state": {
              return await client.get(`/instance/connectionState/${instance}`);
            }
            case "list_instances": {
              return await client.get(`/instance/fetchInstances`);
            }
            case "list_labels": {
              return await client.get(`/label/findLabels/${instance}`);
            }
            case "handle_label": {
              return await client.send(`/label/handleLabel/${instance}`, {
                number: args.number,
                labelId: args.labelId,
                action: args.label_action,
              });
            }
            case "api_raw": {
              if (args.method === "GET") {
                return await client.get(args.endpoint);
              } else {
                const body = args.body ? JSON.parse(args.body) : undefined;
                return await client.send(args.endpoint, body);
              }
            }
          }
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
