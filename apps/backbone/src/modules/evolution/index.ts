import type { BackboneModule, ModuleContext, ModuleHealth } from "../types.js";
import { loadEvolutionConfig } from "./config.js";
import { EvolutionProbe } from "./probe.js";
import { EvolutionStateTracker } from "./state.js";
import { EvolutionPatternDetector } from "./patterns.js";
import { EvolutionActions } from "./actions.js";
import { createEvolutionRoutes } from "./routes.js";
import type { EvolutionConfig } from "./types.js";

let probe: EvolutionProbe | null = null;
let stateTracker: EvolutionStateTracker | null = null;
let patternDetector: EvolutionPatternDetector | null = null;
let actions: EvolutionActions | null = null;
let config: EvolutionConfig | null = null;

export const evolutionModule: BackboneModule = {
  name: "evolution",

  routes: undefined,

  async start(ctx: ModuleContext): Promise<void> {
    config = loadEvolutionConfig(ctx.contextDir);
    ctx.log("config loaded");

    // Initialize components
    probe = new EvolutionProbe(ctx, config);
    stateTracker = new EvolutionStateTracker(ctx.eventBus, ctx.log);
    patternDetector = new EvolutionPatternDetector(ctx.eventBus, config, ctx.log);
    actions = new EvolutionActions(ctx.eventBus, config, ctx.log, ctx.env as Record<string, string | undefined>);

    // Wire probe → state tracker → pattern detector
    probe.onInstances = (rawInstances) => {
      stateTracker!.update(rawInstances);
      patternDetector!.checkProlongedOffline(stateTracker!.getInstances());
    };

    // Wire state change events → pattern detector + actions counter reset
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

    // Create routes (must set before loader mounts them)
    this.routes = createEvolutionRoutes({
      probe,
      state: stateTracker,
      actions,
    });

    // Start the probe loop
    probe.start();
    ctx.log("started");
  },

  async stop(): Promise<void> {
    if (probe) {
      probe.stop();
      probe = null;
    }
    stateTracker = null;
    patternDetector = null;
    actions = null;
    config = null;
  },

  health(): ModuleHealth {
    if (!probe) {
      return { status: "unhealthy", details: { reason: "not started" } };
    }

    const apiState = probe.getState();
    const instances = stateTracker?.getInstances() ?? [];
    const offlineCount = instances.filter((i) => i.state === "close").length;
    const totalCount = instances.length;

    if (apiState === "offline") {
      return {
        status: "unhealthy",
        details: { reason: "api_offline", instances: totalCount },
      };
    }

    if (apiState === "unknown") {
      return {
        status: "degraded",
        details: { reason: "api_unknown", instances: totalCount },
      };
    }

    // API online — check instance health
    if (offlineCount > 0) {
      return {
        status: "degraded",
        details: {
          reason: "instances_offline",
          online: totalCount - offlineCount,
          offline: offlineCount,
          total: totalCount,
        },
      };
    }

    return {
      status: "healthy",
      details: {
        instances: totalCount,
      },
    };
  },
};
