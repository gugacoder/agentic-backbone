import type { ConnectorDef } from "../types.js";
import { credentialSchema, optionsSchema } from "./schemas.js";
import { createElevenLabsClient } from "./client.js";
import { createSpeakTool } from "./tools/speak.js";
import { createListVoicesTool } from "./tools/list-voices.js";

export const elevenLabsConnector: ConnectorDef = {
  slug: "elevenlabs",
  credentialSchema,
  optionsSchema,
  createClient(credential, options) {
    return createElevenLabsClient(
      credentialSchema.parse(credential),
      optionsSchema.parse(options),
    );
  },
  createTools(adapters) {
    if (adapters.length === 0) return null;
    return {
      ...createSpeakTool(adapters),
      ...createListVoicesTool(adapters),
    };
  },
};
