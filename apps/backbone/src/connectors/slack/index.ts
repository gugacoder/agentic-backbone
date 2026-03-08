import type { ConnectorDef, ConnectorContext } from "../types.js";
import { credentialSchema, optionsSchema } from "./schemas.js";
import { createSlackRoutes } from "./routes.js";
import { registerSlackChannelAdapter } from "./channel-adapter.js";
import { createSlackTools } from "./tools/index.js";

export const slackConnector: ConnectorDef = {
  slug: "slack",
  credentialSchema,
  optionsSchema,

  createClient(credential) {
    // Client is created on-demand in tools/routes/adapter; no persistent client needed
    return { credential: credentialSchema.parse(credential) };
  },

  createTools(adapters) {
    if (adapters.length === 0) return null;
    const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
    return createSlackTools(slugs);
  },

  async start(ctx: ConnectorContext) {
    const findAdapter = async (slug: string) => {
      const { connectorRegistry } = await import("../index.js");
      return connectorRegistry.findAdapter(slug);
    };

    this.routes = createSlackRoutes({ findAdapter });

    registerSlackChannelAdapter(ctx);

    ctx.log("started");
  },

  async stop() {
    this.routes = undefined;
  },
};
