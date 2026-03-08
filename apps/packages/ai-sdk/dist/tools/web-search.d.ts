/**
 * A single search result returned by a WebSearch provider.
 */
export interface WebSearchResult {
    title: string;
    url: string;
    snippet: string;
}
/**
 * Callback type for pluggable web search providers.
 * Implementors receive the query and desired number of results,
 * and return an array of WebSearchResult.
 */
export type WebSearchProvider = (query: string, numResults: number) => Promise<WebSearchResult[]>;
/**
 * Factory that creates the WebSearch tool with an injected search provider.
 * If no provider is given, returns a tool that explains no provider is configured.
 */
export declare function createWebSearchTool(searchProvider?: WebSearchProvider): any;
