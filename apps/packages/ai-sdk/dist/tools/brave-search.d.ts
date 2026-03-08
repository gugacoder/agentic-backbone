import type { WebSearchResult } from "./web-search.js";
/**
 * Brave Web Search API client.
 * Docs: https://api.search.brave.com/app#/documentation/web-search
 */
export declare function braveSearch(query: string, numResults: number, apiKey: string): Promise<WebSearchResult[]>;
