import type { ConnectorDef, ConnectorContext } from "../types.js";
import { credentialSchema, optionsSchema } from "./schemas.js";
import { createTwilioClient } from "./client.js";
import { createTwilioTools } from "./tools/index.js";
import { createTwilioRoutes } from "./routes.js";
import { listActiveCalls, clearCalls } from "./calls.js";
import { findChannelsByAdapter } from "../../channels/lookup.js";
import { loadCallbackBaseUrl, refreshNgrokUrl, resolveAdapterCredential } from "./config.js";
import { formatError } from "../../utils/errors.js";

let started = false;

export const twilioConnector: ConnectorDef = {
  slug: "twilio",
  credentialSchema,
  optionsSchema,

  createClient(credential, options) {
    return createTwilioClient(
      credentialSchema.parse(credential),
      optionsSchema.parse(options),
    );
  },

  createTools(_adapters) {
    // Twilio tools don't use adapters — they use channel config directly
    return createTwilioTools();
  },

  routes: undefined,

  async start(ctx: ConnectorContext) {
    const channels = findChannelsByAdapter("twilio-voice");
    if (channels.length === 0) {
      ctx.log("no twilio-voice channels found, skipping");
      return;
    }

    // Cache adapter credentials and ngrok URL
    await resolveAdapterCredential();
    await refreshNgrokUrl();

    try {
      loadCallbackBaseUrl(ctx.env);
    } catch (err) {
      ctx.log(`callback URL not configured, skipping: ${formatError(err)}`);
      return;
    }

    this.routes = createTwilioRoutes();

    ctx.registerChannelAdapter("twilio-voice", () => ({
      slug: "twilio-voice",
      async send() {
        // Voice responses are delivered synchronously via TwiML in webhook handlers.
      },
      health() {
        const calls = listActiveCalls();
        return {
          status: "healthy" as const,
          details: { activeCalls: calls.length },
        };
      },
    }));

    started = true;
    ctx.log(`started (${channels.length} channel(s))`);
  },

  async stop() {
    clearCalls();
    started = false;
    this.routes = undefined;
  },

  health() {
    if (!started) {
      return { status: "unhealthy" as const, details: { reason: "not started" } };
    }
    const calls = listActiveCalls();
    return {
      status: "healthy" as const,
      details: { activeCalls: calls.length },
    };
  },
};
