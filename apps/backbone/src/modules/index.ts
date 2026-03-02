import type { BackboneModule } from "./types.js";
import { evolutionModule } from "./evolution/index.js";
import { twilioModule } from "./twilio/index.js";

/**
 * Registered modules — explicit array, no filesystem discovery.
 * Order determines startup sequence (reverse for shutdown).
 *
 * Conditional registration: modules that depend on environment
 * variables are only included when those variables are defined.
 */
export const modules: BackboneModule[] = [
  ...(process.env.EVOLUTION_URL ? [evolutionModule] : []),
  ...(process.env.TWILIO_ACCOUNT_SID ? [twilioModule] : []),
];
