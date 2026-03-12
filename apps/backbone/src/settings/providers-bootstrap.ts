import { loadProvidersConfig } from "./providers.js";

export function bootstrapProviders(): void {
  try {
    const config = loadProvidersConfig();

    if (config.openrouter?.api_key && !process.env.OPENROUTER_API_KEY) {
      process.env.OPENROUTER_API_KEY = config.openrouter.api_key;
      console.log("[providers] OPENROUTER_API_KEY loaded from settings.yml");
    }

    if (config.openai?.api_key && !process.env.OPENAI_API_KEY) {
      process.env.OPENAI_API_KEY = config.openai.api_key;
      console.log("[providers] OPENAI_API_KEY loaded from settings.yml");
    }

    if (config.brave?.api_key && !process.env.BRAVE_API_KEY) {
      process.env.BRAVE_API_KEY = config.brave.api_key;
      console.log("[providers] BRAVE_API_KEY loaded from settings.yml");
    }
  } catch (err) {
    console.warn("[providers] Failed to load providers config:", err);
  }
}
