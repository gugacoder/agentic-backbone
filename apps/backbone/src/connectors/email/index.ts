import type { ConnectorDef, ConnectorContext } from "../types.js";
import { credentialSchema, optionsSchema } from "./schemas.js";
import { createEmailClient } from "./client.js";
import {
  startEmailPolling,
  stopAllEmailPolling,
  pollingStatus,
} from "./channel-adapter.js";

export const emailConnector: ConnectorDef = {
  slug: "email",
  credentialSchema,
  optionsSchema,

  createClient(credential, options) {
    const cred = credentialSchema.parse(credential);
    const opts = optionsSchema.parse(options);
    return createEmailClient(cred, opts);
  },

  createTools(_adapters) {
    // Tools are defined in F-134; not part of F-133
    return null;
  },

  async start(ctx: ConnectorContext) {
    const { connectorRegistry } = await import("../index.js");

    // Scan all adapters to find email ones and start polling for each
    const allAdapters = connectorRegistry.listAdapters();
    const emailAdapters = allAdapters.filter((a) => a.connector === "email");

    if (emailAdapters.length === 0) {
      ctx.log("no email adapters configured — polling not started");
      return;
    }

    for (const adapter of emailAdapters) {
      const optsResult = optionsSchema.safeParse(adapter.options);
      if (!optsResult.success) {
        ctx.log(`invalid options for adapter "${adapter.slug}" — skipping`);
        continue;
      }
      const intervalSeconds = optsResult.data.poll_interval_seconds;
      startEmailPolling(adapter.slug, intervalSeconds);
    }

    ctx.log(`started — polling ${emailAdapters.length} adapter(s)`);
  },

  async stop() {
    stopAllEmailPolling();
  },

  health() {
    const statuses = [...pollingStatus.entries()];
    if (statuses.length === 0) {
      return { status: "healthy" as const, details: { adapters: 0 } };
    }

    const degraded = statuses.filter(([, s]) => s.lastError !== null);
    if (degraded.length === statuses.length) {
      return {
        status: "unhealthy" as const,
        details: {
          adapters: statuses.length,
          errors: degraded.map(([id, s]) => ({ id, error: s.lastError })),
        },
      };
    }
    if (degraded.length > 0) {
      return {
        status: "degraded" as const,
        details: { adapters: statuses.length, errorCount: degraded.length },
      };
    }

    return { status: "healthy" as const, details: { adapters: statuses.length } };
  },
};
