import { tool } from "ai";
import { z } from "zod";

export function createWhatsappGroupUpdateSettingTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_group_update_setting: tool({
      description: "Altera configuracoes de um grupo no WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        groupJid: z.string().describe("JID do grupo (ex: 120363000000000000@g.us)"),
        action: z.enum(["announcement", "not_announcement", "locked", "unlocked"]).describe("Configuracao: announcement (so admins enviam), not_announcement (todos enviam), locked (so admins editam info), unlocked (todos editam info)"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.send(`/group/updateSetting/${args.instance}`, {
            groupJid: args.groupJid,
            action: args.action,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
