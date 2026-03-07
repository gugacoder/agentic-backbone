import type { ConnectorDef, ConnectorContext } from "../types.js";
import { credentialSchema, optionsSchema } from "./schemas.js";
import { createWhatsAppCloudClient } from "./client.js";
import { createWhatsAppCloudRoutes } from "./routes.js";
import { createWhatsAppCloudTools } from "./tools/index.js";

export const whatsappCloudConnector: ConnectorDef = {
  slug: "whatsapp-cloud",
  credentialSchema,
  optionsSchema,

  createClient(credential, options) {
    const cred = credentialSchema.parse(credential);
    const opts = optionsSchema.parse(options);
    return createWhatsAppCloudClient(cred, opts);
  },

  createTools(adapters) {
    if (adapters.length === 0) return null;
    const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
    return createWhatsAppCloudTools(slugs);
  },

  async start(ctx: ConnectorContext) {
    // findAdapter is resolved via dynamic import to break the circular dependency
    // at initialization time. By the time HTTP requests arrive, all modules are
    // fully initialized and the dynamic import returns the cached module.
    const findAdapter = async (slug: string) => {
      const { connectorRegistry } = await import("../index.js");
      return connectorRegistry.findAdapter(slug);
    };

    this.routes = createWhatsAppCloudRoutes({ findAdapter });

    // Register "whatsapp-cloud" channel adapter
    ctx.registerChannelAdapter("whatsapp-cloud", (channelConfig) => {
      const adapterId = channelConfig.instance as string;

      return {
        slug: "whatsapp-cloud",

        async send({ content, metadata }) {
          const recipientId = metadata?.recipientId as string | undefined;
          if (!recipientId) {
            console.warn("[whatsapp-cloud-adapter] send sem recipientId — ignorando");
            return;
          }

          const { connectorRegistry } = await import("../index.js");
          const adapter = connectorRegistry.findAdapter(adapterId);
          if (!adapter) {
            console.error(`[whatsapp-cloud-adapter] adapter "${adapterId}" not found`);
            return;
          }

          const credResult = credentialSchema.safeParse(adapter.credential);
          const optsResult = optionsSchema.safeParse(adapter.options);
          if (!credResult.success) {
            console.error(
              `[whatsapp-cloud-adapter] invalid credential for "${adapterId}"`
            );
            return;
          }

          const client = createWhatsAppCloudClient(
            credResult.data,
            optsResult.success
              ? optsResult.data
              : { api_version: "v19.0", auto_reply_read: true }
          );

          try {
            await client.sendText(recipientId, content);
          } catch (err) {
            console.error(`[whatsapp-cloud-adapter] sendText failed:`, err);
          }
        },

        health() {
          return { status: "healthy" as const };
        },
      };
    });

    ctx.log("started");
  },

  async stop() {
    this.routes = undefined;
  },
};
