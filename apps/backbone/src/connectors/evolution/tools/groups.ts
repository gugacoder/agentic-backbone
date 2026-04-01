import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

const createParams = z.object({
  action: z.literal("create"),
  subject: z.string().describe("Nome do grupo"),
  participants: z.array(z.string()).describe("Lista de numeros dos participantes no formato internacional sem +"),
  description: z.string().optional().describe("Descricao do grupo"),
});

const listParams = z.object({
  action: z.literal("list"),
});

const infoParams = z.object({
  action: z.literal("info"),
  groupJid: z.string().describe("JID do grupo (ex: 120363000000000000@g.us)"),
});

const participantsParams = z.object({
  action: z.literal("participants"),
  groupJid: z.string().describe("JID do grupo (ex: 120363000000000000@g.us)"),
});

const inviteCodeParams = z.object({
  action: z.literal("invite_code"),
  groupJid: z.string().describe("JID do grupo (ex: 120363000000000000@g.us)"),
});

const sendInviteParams = z.object({
  action: z.literal("send_invite"),
  groupJid: z.string().describe("JID do grupo (ex: 120363000000000000@g.us)"),
  numbers: z.array(z.string()).describe("Lista de numeros a convidar no formato internacional sem +"),
});

const updateParticipantParams = z.object({
  action: z.literal("update_participant"),
  groupJid: z.string().describe("JID do grupo (ex: 120363000000000000@g.us)"),
  participants: z.array(z.string()).describe("Lista de numeros dos participantes no formato internacional sem +"),
  participant_action: z.enum(["add", "remove", "promote", "demote"]).describe("Acao: add (adicionar), remove (remover), promote (promover a admin), demote (rebaixar de admin)"),
});

const updateSettingParams = z.object({
  action: z.literal("update_setting"),
  groupJid: z.string().describe("JID do grupo (ex: 120363000000000000@g.us)"),
  setting: z.enum(["announcement", "not_announcement", "locked", "unlocked"]).describe("Configuracao: announcement (so admins enviam), not_announcement (todos enviam), locked (so admins editam info), unlocked (todos editam info)"),
});

const updateSubjectParams = z.object({
  action: z.literal("update_subject"),
  groupJid: z.string().describe("JID do grupo (ex: 120363000000000000@g.us)"),
  subject: z.string().describe("Novo nome do grupo"),
});

const updateDescriptionParams = z.object({
  action: z.literal("update_description"),
  groupJid: z.string().describe("JID do grupo (ex: 120363000000000000@g.us)"),
  description: z.string().describe("Nova descricao do grupo"),
});

const leaveParams = z.object({
  action: z.literal("leave"),
  groupJid: z.string().describe("JID do grupo (ex: 120363000000000000@g.us)"),
});

const paramsSchema = z.discriminatedUnion("action", [
  createParams,
  listParams,
  infoParams,
  participantsParams,
  inviteCodeParams,
  sendInviteParams,
  updateParticipantParams,
  updateSettingParams,
  updateSubjectParams,
  updateDescriptionParams,
  leaveParams,
]);

export function createWhatsappGroupsTool(slugs: [string, ...string[]]): Record<string, any> {
  const defaultSlug = slugs[0];

  return {
    whatsapp_groups: tool({
      description: [
        "Gerencia grupos do WhatsApp.",
        "Acoes: create, list, info, participants, invite_code, send_invite, update_participant, update_setting, update_subject, update_description, leave.",
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
            case "create": {
              return await client.send(`/group/create/${instance}`, {
                subject: args.subject,
                participants: args.participants,
                description: args.description,
              });
            }
            case "list": {
              return await client.get(`/group/fetchAllGroups/${instance}`);
            }
            case "info": {
              return await client.get(`/group/findGroupInfos/${instance}?groupJid=${args.groupJid}`);
            }
            case "participants": {
              return await client.get(`/group/participants/${instance}?groupJid=${args.groupJid}`);
            }
            case "invite_code": {
              return await client.get(`/group/inviteCode/${instance}?groupJid=${args.groupJid}`);
            }
            case "send_invite": {
              return await client.send(`/group/sendInvite/${instance}`, {
                groupJid: args.groupJid,
                numbers: args.numbers,
              });
            }
            case "update_participant": {
              return await client.send(`/group/updateParticipant/${instance}`, {
                groupJid: args.groupJid,
                participants: args.participants,
                action: args.participant_action,
              });
            }
            case "update_setting": {
              return await client.send(`/group/updateSetting/${instance}`, {
                groupJid: args.groupJid,
                action: args.setting,
              });
            }
            case "update_subject": {
              return await client.send(`/group/updateGroupSubject/${instance}`, {
                groupJid: args.groupJid,
                subject: args.subject,
              });
            }
            case "update_description": {
              return await client.send(`/group/updateGroupDescription/${instance}`, {
                groupJid: args.groupJid,
                description: args.description,
              });
            }
            case "leave": {
              return await client.delete(`/group/leaveGroup/${instance}?groupJid=${args.groupJid}`);
            }
          }
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
