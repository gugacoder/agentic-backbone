import { createSendWhatsAppTextTool } from "./send-text.js";
import { createSendWhatsAppTemplateTool } from "./send-template.js";
import { createGetWhatsAppMediaTool } from "./get-media.js";

export function createWhatsAppCloudTools(slugs: [string, ...string[]]): Record<string, unknown> {
  return {
    ...createSendWhatsAppTextTool(slugs),
    ...createSendWhatsAppTemplateTool(slugs),
    ...createGetWhatsAppMediaTool(slugs),
  };
}
