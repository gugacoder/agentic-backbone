import type { ConnectorDef } from "../types.js";
import { credentialSchema, optionsSchema } from "./schemas.js";
import { createMysqlClient } from "./client.js";
import { createMysqlQueryTool } from "./tools/query.js";
import { createMysqlMutateTool } from "./tools/mutate.js";

export const mysqlConnector: ConnectorDef = {
  slug: "mysql",
  credentialSchema,
  optionsSchema,
  createClient(credential, options) {
    return createMysqlClient(
      credentialSchema.parse(credential),
      optionsSchema.parse(options),
    );
  },
  createTools(adapters) {
    if (adapters.length === 0) return null;
    const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
    const policyMap = new Map(adapters.map((a) => [a.slug, a.policy]));
    return {
      ...createMysqlQueryTool(slugs),
      ...createMysqlMutateTool(slugs, policyMap),
    };
  },
};
