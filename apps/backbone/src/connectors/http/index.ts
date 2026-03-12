import type { ConnectorDef } from "../types.js";
import { credentialSchema, optionsSchema } from "./schemas.js";
import { createHttpClient } from "./client.js";
import { createHttpRequestTool } from "./tools/http-request.js";

export const httpConnector: ConnectorDef = {
  slug: "http",
  credentialSchema,
  optionsSchema,
  createClient(credential, options) {
    return createHttpClient(
      credentialSchema.parse(credential),
      optionsSchema.parse(options),
    );
  },
  createTools(adapters) {
    if (adapters.length === 0) return null;
    return createHttpRequestTool(adapters);
  },
};
