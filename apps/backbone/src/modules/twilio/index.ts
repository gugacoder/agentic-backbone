import type { BackboneModule, ModuleContext, ModuleHealth } from "../types.js";
import { loadTwilioConfig } from "./config.js";
import { createTwilioRoutes } from "./routes.js";
import { listActiveCalls, clearCalls } from "./calls.js";
import type { TwilioConfig } from "./types.js";

let config: TwilioConfig | null = null;

export const twilioModule: BackboneModule = {
  name: "twilio",

  routes: undefined,

  async start(ctx: ModuleContext): Promise<void> {
    config = loadTwilioConfig(ctx.env);
    ctx.log("config loaded");

    // Create routes
    this.routes = createTwilioRoutes(config);

    // Register "twilio-voice" channel-adapter
    // Voice is synchronous via TwiML webhook response pattern — send() is a no-op
    ctx.registerChannelAdapter("twilio-voice", () => ({
      slug: "twilio-voice",

      async send() {
        // Voice responses are delivered synchronously via TwiML in webhook handlers.
        // This adapter exists only for channel registration/lookup purposes.
      },
    }));

    ctx.log("started");
  },

  async stop(): Promise<void> {
    clearCalls();
    config = null;
    this.routes = undefined;
  },

  health(): ModuleHealth {
    if (!config) {
      return { status: "unhealthy", details: { reason: "not started" } };
    }

    const calls = listActiveCalls();
    return {
      status: "healthy",
      details: {
        activeCalls: calls.length,
      },
    };
  },
};
