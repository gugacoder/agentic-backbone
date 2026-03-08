import { z } from "zod";

export const OTelConfigSchema = z.object({
  enabled: z.boolean().default(false),
  endpoint: z.string().default(""),
  headers: z.record(z.string()).default({}),
  samplingRate: z.number().min(0).max(1).default(1.0),
  agentFilter: z.array(z.string()).default([]),
  operationFilter: z.array(z.string()).default([]),
});

export type OTelConfig = z.infer<typeof OTelConfigSchema>;

export const DEFAULT_OTEL_CONFIG: OTelConfig = {
  enabled: false,
  endpoint: "",
  headers: {},
  samplingRate: 1.0,
  agentFilter: [],
  operationFilter: [],
};
