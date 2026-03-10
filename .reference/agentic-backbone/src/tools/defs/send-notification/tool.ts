/**
 * send_notification — Drop-in tool para o backbone.
 *
 * Envia notificacoes diretamente via notification-gateway (sem passar pelo cia-api).
 * O gateway aplica regras de lista e resolve telefone via ContactRef.
 * Outbound: backbone → notification-gateway → Laravel → WhatsApp.
 */

import { z } from "zod";
import type { ToolDefinition } from "../../../agent/tool-defs.js";
import { gateway } from "../../../lib/gateway.js";

const VALID_SOURCES = [
  'relatorios.envio',
  'relatorios.feedback',
  'relatorios.lembrete',
  'recrutamento.pipeline',
  'recrutamento.resposta',
  'expectativas.envio',
  'expectativas.notificacao',
  'expectativas.resposta',
  'monitoramento.alerta',
] as const;

const parameters = z.object({
  source: z.enum(VALID_SOURCES).describe('Identificador da origem (source registrada no gateway)'),
  event: z.string().describe('Identificador do evento. Ex: "mudanca-turno"'),
  contact_type: z
    .enum(["funcionario", "cliente", "responsavel", "candidato-curriculo"])
    .describe("Tipo do contato destinatario"),
  contact_id: z.number().int().describe("ID do contato destinatario"),
  message: z.string().describe("Corpo da mensagem"),
  media: z.enum(["whatsapp", "email", "both"]).describe("Canal de entrega"),
  attachments: z.array(z.string()).optional().describe("URLs de anexos (opcional)"),
});

type Input = z.infer<typeof parameters>;

export const sendNotificationTool: ToolDefinition = {
  name: "send_notification",
  description:
    "Envia uma notificacao para um contato do sistema usando o gateway centralizado. " +
    "Respeita listas de controle configuradas (interceptacao, bloqueios). " +
    "Envia via WhatsApp diretamente pelo Laravel (sem depender do cia-api).",
  parameters,
  execute: async (args: Input) => {
    try {
      return await gateway({
        source: args.source,
        event: args.event,
        recipient: { type: args.contact_type, id: String(args.contact_id) },
        message: args.message,
        media: args.media,
        attachments: args.attachments,
        tenantId: 1,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { delivered: false, error: `Gateway error: ${message}` };
    }
  },
};
