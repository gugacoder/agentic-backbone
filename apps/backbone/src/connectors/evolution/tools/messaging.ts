import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

const quotedSchema = z.object({
  key: z.object({
    id: z.string().describe("ID da mensagem citada"),
    remoteJid: z.string().describe("JID do chat"),
    fromMe: z.boolean().describe("Se a mensagem citada foi enviada por nos"),
  }),
});

const contactItemSchema = z.object({
  fullName: z.string().describe("Nome completo do contato"),
  wuid: z.string().describe("WhatsApp ID do contato (numero@s.whatsapp.net)"),
  phoneNumber: z.string().describe("Numero de telefone do contato"),
});

const messageKeySchema = z.object({
  id: z.string().describe("ID da mensagem a reagir"),
  remoteJid: z.string().describe("JID do chat (numero@s.whatsapp.net ou grupo@g.us)"),
  fromMe: z.boolean().describe("Se a mensagem foi enviada por nos"),
});

const listSectionSchema = z.object({
  title: z.string().describe("Titulo da secao"),
  rows: z.array(z.object({
    title: z.string().describe("Titulo da opcao"),
    description: z.string().optional().describe("Descricao da opcao"),
    rowId: z.string().describe("ID unico da opcao"),
  })).describe("Opcoes dentro da secao"),
});

const buttonSchema = z.object({
  buttonId: z.string().describe("ID unico do botao"),
  buttonText: z.object({
    displayText: z.string().describe("Texto exibido no botao"),
  }),
  type: z.literal(1).optional(),
});

const sendTextParams = z.object({ action: z.literal("send_text") }).extend({
  number: z.string().describe("Numero do destinatario no formato internacional sem + (ex: 5532988887777)"),
  text: z.string().describe("Texto da mensagem"),
  delay: z.number().optional().describe("Atraso em ms antes de enviar (simula digitacao)"),
  linkPreview: z.boolean().optional().describe("Se deve gerar preview de links"),
  quoted: quotedSchema.optional().describe("Mensagem a citar (reply)"),
  mentioned: z.array(z.string()).optional().describe("Lista de numeros a mencionar"),
});

const sendMediaParams = z.object({ action: z.literal("send_media") }).extend({
  number: z.string().describe("Numero do destinatario no formato internacional sem + (ex: 5532988887777)"),
  mediatype: z.enum(["image", "document", "video", "audio"]).describe("Tipo da midia"),
  media: z.string().describe("URL publica da midia"),
  caption: z.string().optional().describe("Legenda da midia"),
  fileName: z.string().optional().describe("Nome do arquivo (para documentos)"),
});

const sendAudioParams = z.object({ action: z.literal("send_audio") }).extend({
  number: z.string().describe("Numero do destinatario no formato internacional sem + (ex: 5532988887777)"),
  audio: z.string().describe("URL publica do arquivo de audio"),
});

const sendLocationParams = z.object({ action: z.literal("send_location") }).extend({
  number: z.string().describe("Numero do destinatario no formato internacional sem + (ex: 5532988887777)"),
  latitude: z.number().describe("Latitude da localizacao"),
  longitude: z.number().describe("Longitude da localizacao"),
  name: z.string().describe("Nome do local"),
  address: z.string().describe("Endereco do local"),
});

const sendContactParams = z.object({ action: z.literal("send_contact") }).extend({
  number: z.string().describe("Numero do destinatario no formato internacional sem + (ex: 5532988887777)"),
  contact: z.array(contactItemSchema).describe("Lista de contatos a enviar"),
});

const sendReactionParams = z.object({ action: z.literal("send_reaction") }).extend({
  key: messageKeySchema.describe("Chave da mensagem a reagir"),
  reaction: z.string().describe("Emoji da reacao (ex: 👍). Envie string vazia para remover reacao"),
});

const sendPollParams = z.object({ action: z.literal("send_poll") }).extend({
  number: z.string().describe("Numero do destinatario no formato internacional sem + (ex: 5532988887777)"),
  name: z.string().describe("Pergunta da enquete"),
  values: z.array(z.string()).min(2).max(10).describe("Opcoes da enquete (2 a 10)"),
  selectableCount: z.number().min(0).max(10).optional().describe("Quantas opcoes podem ser selecionadas (0 = ilimitado, default 1)"),
});

const sendStickerParams = z.object({ action: z.literal("send_sticker") }).extend({
  number: z.string().describe("Numero do destinatario no formato internacional sem + (ex: 5532988887777)"),
  sticker: z.string().describe("URL publica da imagem do sticker"),
});

const sendListParams = z.object({ action: z.literal("send_list") }).extend({
  number: z.string().describe("Numero do destinatario no formato internacional sem + (ex: 5532988887777)"),
  title: z.string().describe("Titulo da lista"),
  footerText: z.string().describe("Texto do rodape"),
  buttonText: z.string().describe("Texto do botao que abre a lista"),
  sections: z.array(listSectionSchema).describe("Secoes da lista"),
});

const sendButtonsParams = z.object({ action: z.literal("send_buttons") }).extend({
  number: z.string().describe("Numero do destinatario no formato internacional sem + (ex: 5532988887777)"),
  title: z.string().describe("Titulo da mensagem"),
  description: z.string().describe("Corpo da mensagem"),
  buttons: z.array(buttonSchema).describe("Lista de botoes (max 3)"),
  footer: z.string().optional().describe("Texto do rodape"),
});

const deleteMessageParams = z.object({ action: z.literal("delete_message") }).extend({
  remoteJid: z.string().describe("JID do chat (numero@s.whatsapp.net ou grupo@g.us)"),
  messageId: z.string().describe("ID da mensagem a apagar"),
  fromMe: z.boolean().describe("Se a mensagem foi enviada por nos"),
});

const markAsReadParams = z.object({ action: z.literal("mark_as_read") }).extend({
  readMessages: z.array(z.object({
    id: z.string().describe("ID da mensagem"),
    remoteJid: z.string().describe("JID do chat (numero@s.whatsapp.net ou grupo@g.us)"),
  })).describe("Lista de mensagens a marcar como lidas"),
});

const sendPresenceParams = z.object({ action: z.literal("send_presence") }).extend({
  number: z.string().describe("Numero do destinatario no formato internacional sem + (ex: 5532988887777)"),
  presence: z.enum(["composing", "recording", "paused"]).describe("Tipo de presenca: composing (digitando), recording (gravando audio), paused (parou)"),
});

const paramsSchema = z.discriminatedUnion("action", [
  sendTextParams,
  sendMediaParams,
  sendAudioParams,
  sendLocationParams,
  sendContactParams,
  sendReactionParams,
  sendPollParams,
  sendStickerParams,
  sendListParams,
  sendButtonsParams,
  deleteMessageParams,
  markAsReadParams,
  sendPresenceParams,
]);

export function createWhatsappMessagingTool(slugs: [string, ...string[]]): Record<string, any> {
  const defaultSlug = slugs[0];

  return {
    whatsapp_messaging: tool({
      description: [
        "Envia e gerencia mensagens via WhatsApp.",
        "Acoes: send_text, send_media, send_audio, send_location, send_contact, send_reaction, send_poll, send_sticker, send_list, send_buttons, delete_message, mark_as_read, send_presence.",
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
            case "send_text": {
              const { action: _a, instance: _i, ...body } = args;
              return await client.send(`/message/sendText/${instance}`, body);
            }
            case "send_media": {
              const { action: _a, instance: _i, ...body } = args;
              return await client.send(`/message/sendMedia/${instance}`, body);
            }
            case "send_audio": {
              return await client.send(`/message/sendWhatsAppAudio/${instance}`, {
                number: args.number,
                audio: args.audio,
              });
            }
            case "send_location": {
              const { action: _a, instance: _i, ...body } = args;
              return await client.send(`/message/sendLocation/${instance}`, body);
            }
            case "send_contact": {
              return await client.send(`/message/sendContact/${instance}`, {
                number: args.number,
                contact: args.contact,
              });
            }
            case "send_reaction": {
              return await client.send(`/message/sendReaction/${instance}`, {
                key: args.key,
                reaction: args.reaction,
              });
            }
            case "send_poll": {
              const { action: _a, instance: _i, ...body } = args;
              return await client.send(`/message/sendPoll/${instance}`, body);
            }
            case "send_sticker": {
              return await client.send(`/message/sendSticker/${instance}`, {
                number: args.number,
                sticker: args.sticker,
              });
            }
            case "send_list": {
              const { action: _a, instance: _i, ...body } = args;
              return await client.send(`/message/sendList/${instance}`, body);
            }
            case "send_buttons": {
              const { action: _a, instance: _i, ...body } = args;
              return await client.send(`/message/sendButtons/${instance}`, body);
            }
            case "delete_message": {
              return await client.send(`/chat/deleteMessageForEveryone/${instance}`, {
                remoteJid: args.remoteJid,
                messageId: args.messageId,
                fromMe: args.fromMe,
              });
            }
            case "mark_as_read": {
              return await client.send(`/chat/markMessageAsRead/${instance}`, {
                readMessages: args.readMessages,
              });
            }
            case "send_presence": {
              return await client.send(`/chat/sendPresence/${instance}`, {
                number: args.number,
                presence: args.presence,
              });
            }
          }
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
