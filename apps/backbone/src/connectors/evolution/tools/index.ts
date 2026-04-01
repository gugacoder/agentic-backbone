import { createWhatsappMessagingTool } from "./messaging.js";
import { createWhatsappGroupsTool } from "./groups.js";
import { createWhatsappContactsTool } from "./contacts.js";
import { createWhatsappAdminTool } from "./admin.js";

export function createEvolutionTools(slugs: [string, ...string[]]): Record<string, any> {
  return {
    ...createWhatsappMessagingTool(slugs),
    ...createWhatsappGroupsTool(slugs),
    ...createWhatsappContactsTool(slugs),
    ...createWhatsappAdminTool(slugs),
  };
}
