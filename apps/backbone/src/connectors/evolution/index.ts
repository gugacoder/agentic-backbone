import type { ConnectorDef, ConnectorContext } from "../types.js";
import { credentialSchema, optionsSchema } from "./schemas.js";
import { createEvolutionClient } from "./client.js";
import { createEvolutionTools } from "./tools/index.js";
import { defaultEvolutionConfig } from "./config.js";
import { EvolutionProbe } from "./probe.js";
import { EvolutionStateTracker } from "./state.js";
import { EvolutionPatternDetector } from "./patterns.js";
import { EvolutionActions } from "./actions.js";
import { createEvolutionRoutes } from "./routes.js";

let probe: EvolutionProbe | null = null;
let stateTracker: EvolutionStateTracker | null = null;
let patternDetector: EvolutionPatternDetector | null = null;
let actions: EvolutionActions | null = null;

function calculateHumanDelay(text: string): number {
  const length = text.length;
  const baseMs = length * 50;
  const jitter = 0.85 + Math.random() * 0.3;
  return Math.round(Math.max(400, Math.min(10_000, baseMs * jitter)));
}

async function syncWebhooks(
  env: Record<string, string | undefined>,
  log: (msg: string) => void,
): Promise<void> {
  const baseUrl = env.EVOLUTION_URL!;
  const apiKey = env.EVOLUTION_API_KEY!;
  const callbackHost = env.BACKBONE_CALLBACK_HOST ?? "localhost";
  const backbonePort = env.BACKBONE_PORT;
  const webhookUrl = `http://${callbackHost}:${backbonePort}/api/v1/ai/connectors/evolution/webhook`;

  const res = await fetch(`${baseUrl}/instance/fetchInstances`, {
    headers: { apikey: apiKey },
  });
  if (!res.ok) {
    log(`webhook sync: fetchInstances failed HTTP ${res.status}`);
    return;
  }

  const instances = (await res.json()) as { name?: string }[];

  for (const entry of instances) {
    const name = entry.name;
    if (!name) continue;

    try {
      const setRes = await fetch(`${baseUrl}/webhook/set/${name}`, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            webhook_by_events: false,
            events: ["MESSAGES_UPSERT"],
          },
        }),
      });
      log(`webhook sync: ${name} → ${setRes.ok ? "ok" : `HTTP ${setRes.status}`}`);
    } catch (err) {
      log(`webhook sync: ${name} → failed: ${err}`);
    }
  }
}

export const evolutionConnector: ConnectorDef = {
  slug: "evolution",
  credentialSchema,
  optionsSchema,

  createClient(credential, options) {
    const cred = credentialSchema.parse(credential);
    const opts = optionsSchema.parse(options);
    return createEvolutionClient(cred, opts);
  },

  createTools(adapters) {
    if (adapters.length === 0) return null;
    const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
    return createEvolutionTools(slugs);
  },

  routes: undefined,

  async start(ctx: ConnectorContext) {
    if (!ctx.env.EVOLUTION_URL) {
      ctx.log("EVOLUTION_URL not set, skipping");
      return;
    }

    const config = defaultEvolutionConfig;

    // Initialize components
    probe = new EvolutionProbe(ctx, config);
    stateTracker = new EvolutionStateTracker(ctx.eventBus, ctx.log);
    patternDetector = new EvolutionPatternDetector(ctx.eventBus, config, ctx.log);
    actions = new EvolutionActions(ctx.eventBus, config, ctx.log, ctx.env);

    // Wire probe → state tracker → pattern detector
    probe.onInstances = (rawInstances) => {
      stateTracker!.update(rawInstances);
      patternDetector!.checkProlongedOffline(stateTracker!.getInstances());
    };

    // Wire state change events
    const asEvent = (p: unknown) => p as { instanceName: string };

    ctx.eventBus.onModule("evolution", "instance-connected", (p) => {
      const { instanceName } = asEvent(p);
      actions!.resetCounters(instanceName);
      patternDetector!.recordStateChange(instanceName);
    });

    ctx.eventBus.onModule("evolution", "instance-disconnected", (p) => {
      patternDetector!.recordStateChange(asEvent(p).instanceName);
    });

    ctx.eventBus.onModule("evolution", "instance-reconnecting", (p) => {
      patternDetector!.recordStateChange(asEvent(p).instanceName);
    });

    ctx.eventBus.onModule("evolution", "instance-removed", (p) => {
      const { instanceName } = asEvent(p);
      patternDetector!.clearInstance(instanceName);
      actions!.removeInstance(instanceName);
    });

    // Create routes
    this.routes = createEvolutionRoutes({
      probe,
      state: stateTracker,
      actions,
      env: ctx.env,
    });

    // Register "whatsapp" channel-adapter
    ctx.registerChannelAdapter("whatsapp", (channelConfig) => {
      const instance = channelConfig.instance as string;
      const baseUrl = ctx.env.EVOLUTION_URL!;
      const apiKey = ctx.env.EVOLUTION_API_KEY ?? "";

      return {
        slug: "whatsapp",

        async send({ content, metadata }) {
          const recipientId = metadata?.recipientId as string | undefined;
          if (!recipientId) {
            console.warn("[whatsapp-adapter] send sem recipientId — ignorando");
            return;
          }
          const res = await fetch(`${baseUrl}/message/sendText/${instance}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: apiKey },
            body: JSON.stringify({
              number: recipientId,
              text: content,
              delay: calculateHumanDelay(content),
              presence: "composing",
            }),
          });
          if (!res.ok) {
            console.error(`[whatsapp-adapter] sendText falhou: HTTP ${res.status}`);
          }
        },

        health() {
          const apiState = probe!.getState();
          return {
            status: apiState === "online" ? "healthy" as const : "unhealthy" as const,
          };
        },
      };
    });

    // Start the probe loop
    probe.start();
    ctx.log("started");

    // Sync webhooks for existing instances (fire-and-forget)
    syncWebhooks(ctx.env, ctx.log).catch((err) => {
      ctx.log(`webhook sync failed: ${err}`);
    });
  },

  async stop() {
    if (probe) {
      probe.stop();
      probe = null;
    }
    stateTracker = null;
    patternDetector = null;
    actions = null;
  },

  health() {
    if (!probe) {
      return { status: "unhealthy" as const, details: { reason: "not started" } };
    }

    const apiState = probe.getState();
    const instances = stateTracker?.getInstances() ?? [];
    const offlineCount = instances.filter((i) => i.state === "close").length;
    const totalCount = instances.length;

    if (apiState === "offline") {
      return {
        status: "unhealthy" as const,
        details: { reason: "api_offline", instances: totalCount },
      };
    }

    if (apiState === "unknown") {
      return {
        status: "degraded" as const,
        details: { reason: "api_unknown", instances: totalCount },
      };
    }

    if (offlineCount > 0) {
      return {
        status: "degraded" as const,
        details: {
          reason: "instances_offline",
          online: totalCount - offlineCount,
          offline: offlineCount,
          total: totalCount,
        },
      };
    }

    return {
      status: "healthy" as const,
      details: { instances: totalCount },
    };
  },
};
