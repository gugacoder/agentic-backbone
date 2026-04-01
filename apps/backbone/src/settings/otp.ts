import { existsSync } from "node:fs";
import { z } from "zod";
import { settingsPath } from "../context/paths.js";
import { readYaml } from "../context/readers.js";

const OtpEvolutionSchema = z.object({
  host: z.string().url(),
  "api-key": z.string().min(1),
  instance: z.string().min(1),
});

const OtpConfigSchema = z.object({
  enabled: z.boolean().default(false),
  evolution: OtpEvolutionSchema.optional(),
});

export type OtpConfig = z.infer<typeof OtpConfigSchema>;

export function getOtpConfig(): OtpConfig {
  if (!existsSync(settingsPath())) {
    return { enabled: false };
  }

  const settings = readYaml(settingsPath()) as Record<string, unknown>;
  const rawOtp = settings["otp"];

  if (!rawOtp) {
    return { enabled: false };
  }

  const result = OtpConfigSchema.safeParse(rawOtp);
  if (!result.success) {
    console.warn("[otp] invalid otp config in settings.yml:", result.error.issues);
    return { enabled: false };
  }

  if (result.data.enabled && !result.data.evolution) {
    throw new Error("[otp] otp.enabled is true but otp.evolution is not configured in settings.yml");
  }

  return result.data;
}

export function isOtpEnabled(): boolean {
  const config = getOtpConfig();
  return config.enabled && !!config.evolution;
}
