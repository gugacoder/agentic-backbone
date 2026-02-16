import type { BackboneModule } from "./types.js";

/**
 * Registered modules — explicit array, no filesystem discovery.
 * Order determines startup sequence (reverse for shutdown).
 */
export const modules: BackboneModule[] = [];
