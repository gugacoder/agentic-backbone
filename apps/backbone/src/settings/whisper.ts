import { existsSync } from "node:fs";
import { settingsPath } from "../context/paths.js";
import { readYaml, writeYaml } from "../context/readers.js";

export interface WhisperConfig {
  model: string;
  computeType: string;
}

export function loadWhisperConfig(): WhisperConfig {
  const defaults: WhisperConfig = {
    model: process.env.WHISPER_MODEL ?? "small",
    computeType: process.env.WHISPER_COMPUTE_TYPE ?? "int8",
  };

  if (!existsSync(settingsPath())) return defaults;

  const settings = readYaml(settingsPath()) as Record<string, unknown>;
  const infra = settings["infrastructure"] as Record<string, unknown> | undefined;
  const whisper = infra?.["whisper"] as Record<string, unknown> | undefined;
  if (!whisper) return defaults;

  return {
    model: (whisper["model"] as string | undefined) ?? defaults.model,
    computeType: (whisper["compute-type"] as string | undefined) ?? defaults.computeType,
  };
}

export function saveWhisperConfig(config: WhisperConfig): void {
  const settings = existsSync(settingsPath())
    ? (readYaml(settingsPath()) as Record<string, unknown>)
    : {};

  const infra = (settings["infrastructure"] as Record<string, unknown> | undefined) ?? {};
  infra["whisper"] = {
    model: config.model,
    "compute-type": config.computeType,
  };
  settings["infrastructure"] = infra;
  writeYaml(settingsPath(), settings);
}
