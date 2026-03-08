import { type CoreTool } from "ai";
/**
 * Factory that creates the Batch tool for parallel tool execution.
 *
 * Receives the resolved tool registry so it can look up tools by name.
 * The Batch tool itself is excluded from the registry to prevent recursion.
 */
export declare function createBatchTool(toolRegistry: Record<string, CoreTool>): any;
