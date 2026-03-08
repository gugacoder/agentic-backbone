/**
 * A single code search result returned by a CodeSearch provider.
 */
export interface CodeSearchResult {
    title: string;
    url: string;
    content: string;
}
/**
 * Callback type for pluggable code search providers.
 * Implementors receive the query and return code examples and documentation snippets.
 */
export type CodeSearchProvider = (query: string) => Promise<CodeSearchResult[]>;
/**
 * Factory that creates the CodeSearch tool with an injected search provider.
 * If no provider is given, returns a tool that explains no provider is configured.
 */
export declare function createCodeSearchTool(searchProvider?: CodeSearchProvider): any;
