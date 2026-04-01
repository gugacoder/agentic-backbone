import { Hono } from "hono";
import { z } from "zod";
import { requireSysuser } from "./auth-helpers.js";
import {
  getOTelConfig,
  reinitTelemetry,
  isTelemetryEnabled,
  getExporterStats,
  OTelConfigSchema,
} from "../telemetry/index.js";

export const otelRoutes = new Hono();

// --- GET /settings/otel ---

otelRoutes.get("/settings/otel", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  return c.json(getOTelConfig());
});

// --- PUT /settings/otel ---

otelRoutes.put("/settings/otel", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "JSON inválido" }, 400);
  }

  const result = OTelConfigSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: "Configuração inválida", details: result.error.flatten() }, 400);
  }

  reinitTelemetry(result.data);

  return c.json(result.data);
});

// --- POST /settings/otel/test ---

otelRoutes.post("/settings/otel/test", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const config = getOTelConfig();

  if (!config.enabled || !config.endpoint) {
    return c.json({
      success: false,
      message: "OTel não está habilitado ou endpoint não configurado",
      latencyMs: 0,
    });
  }

  const start = Date.now();

  try {
    // Build a minimal valid OTLP/JSON trace payload
    const traceId = generateHex(32);
    const spanId = generateHex(16);
    const nowNs = (BigInt(Date.now()) * 1_000_000n).toString();
    const endNs = (BigInt(Date.now()) * 1_000_000n + 1_000_000n).toString();

    const payload = {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: "service.name", value: { stringValue: "agentic-backbone" } },
            ],
          },
          scopeSpans: [
            {
              scope: { name: "otel.test" },
              spans: [
                {
                  traceId,
                  spanId,
                  name: "otel.test",
                  kind: 1,
                  startTimeUnixNano: nowNs,
                  endTimeUnixNano: endNs,
                  status: { code: 1 },
                },
              ],
            },
          ],
        },
      ],
    };

    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...config.headers,
      },
      body: JSON.stringify(payload),
    });

    const latencyMs = Date.now() - start;

    if (response.ok) {
      return c.json({
        success: true,
        message: `Span de teste enviado com sucesso para ${config.endpoint}`,
        latencyMs,
      });
    }

    return c.json({
      success: false,
      message: `Endpoint retornou ${response.status}: ${response.statusText}`,
      latencyMs,
    });
  } catch (err) {
    return c.json({
      success: false,
      message: `Erro ao conectar com endpoint: ${String(err)}`,
      latencyMs: Date.now() - start,
    });
  }
});

// --- GET /settings/otel/status ---

otelRoutes.get("/settings/otel/status", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const stats = getExporterStats();
  const enabled = isTelemetryEnabled();

  return c.json({
    connected: enabled && stats.connected,
    spansExported: stats.spansExported,
    errors: stats.errors,
    lastExportAt: stats.lastExportAt,
  });
});

// --- Helpers ---

function generateHex(length: number): string {
  const bytes = new Uint8Array(length / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
