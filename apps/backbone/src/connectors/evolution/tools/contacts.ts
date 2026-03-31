import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

const checkNumbersParams = z.object({
  action: z.literal("check_numbers"),
  numbers: z.array(z.string()).describe("Lista de numeros a verificar no formato internacional sem + (ex: ['5532988887777'])"),
});

const findContactsParams = z.object({
  action: z.literal("find_contacts"),
  where: z.record(z.unknown()).optional().describe("Filtro de busca. Ex: { id: 'numero@s.whatsapp.net' }"),
});

const findMessagesParams = z.object({
  action: z.literal("find_messages"),
  where: z.record(z.unknown()).describe("Filtro de busca. Ex: { key: { remoteJid: 'numero@s.whatsapp.net' } }"),
});

const findChatsParams = z.object({
  action: z.literal("find_chats"),
});

const fetchProfileParams = z.object({
  action: z.literal("fetch_profile"),
  number: z.string().describe("Numero do contato no formato internacional sem + (ex: 5532988887777)"),
});

const blockParams = z.object({
  action: z.literal("block"),
  number: z.string().describe("Numero do contato no formato internacional sem + (ex: 5532988887777)"),
  block_action: z.enum(["block", "unblock"]).describe("Acao: block (bloquear) ou unblock (desbloquear)"),
});

const archiveChatParams = z.object({
  action: z.literal("archive_chat"),
  chat: z.string().describe("JID do chat (numero@s.whatsapp.net ou grupo@g.us)"),
  archive: z.boolean().describe("true para arquivar, false para desarquivar"),
});

const paramsSchema = z.discriminatedUnion("action", [
  checkNumbersParams,
  findContactsParams,
  findMessagesParams,
  findChatsParams,
  fetchProfileParams,
  blockParams,
  archiveChatParams,
]);

export function createWhatsappContactsTool(slugs: [string, ...string[]]): Record<string, any> {
  const defaultSlug = slugs[0];

  return {
    whatsapp_contacts: tool({
      description: [
        "Gerencia contatos e chats do WhatsApp.",
        "Acoes: check_numbers, find_contacts, find_messages, find_chats, fetch_profile, block, archive_chat.",
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
            case "check_numbers": {
              return await client.send(`/chat/whatsappNumbers/${instance}`, {
                numbers: args.numbers,
              });
            }
            case "find_contacts": {
              return await client.send(`/chat/findContacts/${instance}`, {
                where: args.where,
              });
            }
            case "find_messages": {
              return await client.send(`/chat/findMessages/${instance}`, {
                where: args.where,
              });
            }
            case "find_chats": {
              return await client.send(`/chat/findChats/${instance}`, {});
            }
            case "fetch_profile": {
              return await client.send(`/chat/fetchProfile/${instance}`, {
                number: args.number,
              });
            }
            case "block": {
              return await client.send(`/chat/updateBlockStatus/${instance}`, {
                number: args.number,
                action: args.block_action,
              });
            }
            case "archive_chat": {
              return await client.send(`/chat/archiveChat/${instance}`, {
                chat: args.chat,
                archive: args.archive,
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
