import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { trace, type Tracer } from "@opentelemetry/api";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import type { ExportResult } from "@opentelemetry/core";
import { getOTelConfig, setOTelConfig } from "./config.js";
import type { OTelConfig } from "./schemas.js";

export type { OTelConfig } from "./schemas.js";
export { OTelConfigSchema, DEFAULT_OTEL_CONFIG } from "./schemas.js";
export { getOTelConfig, setOTelConfig } from "./config.js";

const SERVICE_NAME = "agentic-backbone";
const SERVICE_VERSION = "0.0.1";

// --- Exporter stats ---

export interface ExporterStats {
  connected: boolean;
  spansExported: number;
  errors: number;
  lastExportAt: string | null;
}

let exporterStats: ExporterStats = {
  connected: false,
  spansExported: 0,
  errors: 0,
  lastExportAt: null,
};

export function getExporterStats(): ExporterStats {
  return { ...exporterStats };
}

function resetExporterStats(): void {
  exporterStats = {
    connected: false,
    spansExported: 0,
    errors: 0,
    lastExportAt: null,
  };
}

// --- Stats-tracking exporter wrapper ---

class StatsTrackingExporter implements SpanExporter {
  private inner: SpanExporter;

  constructor(inner: SpanExporter) {
    this.inner = inner;
  }

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    this.inner.export(spans, (result) => {
      if (result.code === 0 /* SUCCESS */) {
        exporterStats.spansExported += spans.length;
        exporterStats.lastExportAt = new Date().toISOString();
        exporterStats.connected = true;
      } else {
        exporterStats.errors++;
        exporterStats.connected = false;
      }
      resultCallback(result);
    });
  }

  async shutdown(): Promise<void> {
    return this.inner.shutdown();
  }

  forceFlush?(): Promise<void> {
    return (this.inner as any).forceFlush?.() ?? Promise.resolve();
  }
}

// ---

let sdk: NodeSDK | null = null;

function buildResource(_config: OTelConfig): Resource {
  return new Resource({
    "service.name": SERVICE_NAME,
    "service.version": SERVICE_VERSION,
    "deployment.environment": process.env["NODE_ENV"] ?? "production",
  });
}

export function initTelemetry(config?: OTelConfig): void {
  const cfg = config ?? getOTelConfig();

  if (!cfg.enabled || !cfg.endpoint) return;

  // Shutdown previous SDK instance if reinitializing
  if (sdk) {
    sdk.shutdown().catch(() => {});
    sdk = null;
  }

  resetExporterStats();

  const rawExporter = new OTLPTraceExporter({
    url: cfg.endpoint,
    headers: cfg.headers,
  });

  const exporter = new StatsTrackingExporter(rawExporter);

  sdk = new NodeSDK({
    traceExporter: exporter,
    resource: buildResource(cfg),
  });

  sdk.start();
  console.log(`[telemetry] OTel SDK started — endpoint: ${cfg.endpoint}`);
}

export function reinitTelemetry(config: OTelConfig): void {
  setOTelConfig(config);
  initTelemetry(config);
}

export function shutdownTelemetry(): Promise<void> {
  if (!sdk) return Promise.resolve();
  return sdk.shutdown().finally(() => {
    sdk = null;
  });
}

export function getTracer(name = SERVICE_NAME): Tracer {
  return trace.getTracer(name, SERVICE_VERSION);
}

export function isTelemetryEnabled(): boolean {
  const cfg = getOTelConfig();
  return cfg.enabled && !!cfg.endpoint;
}
