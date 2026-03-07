import type { ConnectorDef } from "../types.js";
import { credentialSchema, optionsSchema } from "./schemas.js";
import { createWhatsAppCloudClient } from "./client.js";

export const whatsappCloudConnector: ConnectorDef = {
  slug: "whatsapp-cloud",
  credentialSchema,
  optionsSchema,

  createClient(credential, options) {
    const cred = credentialSchema.parse(credential);
    const opts = optionsSchema.parse(options);
    return createWhatsAppCloudClient(cred, opts);
  },

  createTools(_adapters) {
    return null;
  },
};
