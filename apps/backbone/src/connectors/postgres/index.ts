import type { ConnectorDef } from "../types.js";
import { credentialSchema, optionsSchema } from "./schemas.js";
import { createPostgresClient } from "./client.js";
import { createPostgresQueryTool } from "./tools/query.js";
import { createPostgresMutateTool } from "./tools/mutate.js";

export const postgresConnector: ConnectorDef = {
  slug: "postgres",
  credentialSchema,
  optionsSchema,
  createClient(credential, options) {
    return createPostgresClient(
      credentialSchema.parse(credential),
      optionsSchema.parse(options),
    );
  },
  createTools(adapters) {
    if (adapters.length === 0) return null;
    const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
    const policyMap = new Map(adapters.map((a) => [a.slug, a.policy]));
    return {
      ...createPostgresQueryTool(slugs),
      ...createPostgresMutateTool(slugs, policyMap),
    };
  },
};
