import type { ModuleContext } from "../types.js";
import type { EvolutionConfig, ProbeResult } from "./types.js";

type ApiState = "unknown" | "online" | "offline";

export class EvolutionProbe {
  private state: ApiState = "unknown";
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastProbe: ProbeResult | null = null;
  private baseUrl: string;
  private apiKey: string;

  constructor(
    private ctx: ModuleContext,
    private config: EvolutionConfig,
  ) {
    this.baseUrl = ctx.env.EVOLUTION_URL!;
    this.apiKey = ctx.env.EVOLUTION_API_KEY!;
  }

  /** Callback invoked with raw instance data on each successful probe. */
  onInstances: ((instances: unknown[]) => void) | null = null;

  getState(): ApiState {
    return this.state;
  }

  getLastProbe(): ProbeResult | null {
    return this.lastProbe;
  }

  start(): void {
    this.ctx.log("probe starting");
    // Run first probe immediately, then on interval
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.config.probe.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.ctx.log("probe stopped");
  }

  /** Force an immediate probe tick (e.g. after CRUD operations). */
  async forceTick(): Promise<void> {
    await this.tick();
  }

  private async tick(): Promise<void> {
    const result = await this.fetchInstances();
    this.lastProbe = result;

    const previousState = this.state;

    if (result.status === "online") {
      this.state = "online";

      if (previousState === "offline") {
        this.ctx.eventBus.emitModule("evolution", "api-online", {
          ts: result.timestamp,
        });
      }
      // unknown → online is silent (no event)
    } else {
      this.state = "offline";

      if (previousState === "unknown" || previousState === "online") {
        this.ctx.eventBus.emitModule("evolution", "api-offline", {
          ts: result.timestamp,
          error: result.error,
        });
      }
      // offline → offline stays offline (no event)
    }
  }

  private async fetchInstances(): Promise<ProbeResult> {
    const ts = Date.now();
    const url = `${this.baseUrl}/instance/fetchInstances`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.config.probe.timeoutMs,
      );

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          apikey: this.apiKey,
        },
      });

      clearTimeout(timeout);

      const responseTimeMs = Date.now() - ts;

      if (!response.ok) {
        return {
          timestamp: ts,
          status: "offline",
          responseTimeMs,
          error: `HTTP ${response.status}`,
        };
      }

      const data = (await response.json()) as unknown[];

      // Notify listeners with raw instance data
      if (this.onInstances) {
        this.onInstances(data);
      }

      return {
        timestamp: ts,
        status: "online",
        responseTimeMs,
        error: null,
      };
    } catch (err) {
      const responseTimeMs = Date.now() - ts;
      const isAbort =
        err instanceof DOMException && err.name === "AbortError";

      return {
        timestamp: ts,
        status: "offline",
        responseTimeMs: isAbort ? null : responseTimeMs,
        error: isAbort
          ? "timeout"
          : err instanceof Error
            ? err.message
            : String(err),
      };
    }
  }
}
