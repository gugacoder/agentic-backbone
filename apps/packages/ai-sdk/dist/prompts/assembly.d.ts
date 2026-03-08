export declare function getSystemPrompt(activeTools: string[]): string;
/**
 * Discovers project context files (AGENTS.md, CLAUDE.md) by walking up the
 * directory tree from `cwd` to the project root (.git) or filesystem root.
 *
 * Files are concatenated in root → cwd order (lowest → highest precedence).
 * Empty files are skipped. Total context is truncated to 4000 tokens by
 * removing the most distant files (lowest precedence) first.
 *
 * @param cwd - Starting directory for the walk-up search.
 * @returns Concatenated context string, or empty string if nothing found.
 */
export declare function discoverProjectContext(cwd: string): Promise<string>;
