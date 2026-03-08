/**
 * Returns the context window size for a model ID.
 * If `override` is provided, it takes precedence over the map.
 * Unknown models default to 128000.
 */
export declare function getContextWindow(modelId: string, override?: number): number;
