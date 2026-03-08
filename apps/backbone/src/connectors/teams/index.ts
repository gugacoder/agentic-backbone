import type { ConnectorDef, ConnectorContext } from "../types.js";
import { credentialSchema, optionsSchema } from "./schemas.js";
import { createTeamsRoutes } from "./routes.js";
import { registerTeamsChannelAdapter } from "./channel-adapter.js";
import { createTeamsTools } from "./tools/index.js";

export const teamsConnector: ConnectorDef = {
  slug: "teams",
  credentialSchema,
  optionsSchema,

  createClient(credential) {
    return { credential: credentialSchema.parse(credential) };
  },

  createTools(adapters) {
    if (adapters.length === 0) return null;
    const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
    return createTeamsTools(slugs);
  },

  async start(ctx: ConnectorContext) {
    const findAdapter = async (slug: string) => {
      const { connectorRegistry } = await import("../index.js");
      return connectorRegistry.findAdapter(slug);
    };

    this.routes = createTeamsRoutes({ findAdapter });

    registerTeamsChannelAdapter(ctx);

    ctx.log("started");
  },

  async stop() {
    this.routes = undefined;
  },
};
