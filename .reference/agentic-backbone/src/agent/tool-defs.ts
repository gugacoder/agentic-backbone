import type { ZodType } from "zod";
import { tool as kaiTool } from "ai";
import {
  createSdkMcpServer,
  tool as sdkTool,
} from "@anthropic-ai/claude-agent-sdk";

// Workaround: SDK expects zod v4 types but backbone uses zod v3.
// Both are structurally compatible at runtime.
const claudeTool = sdkTool as (
  name: string,
  description: string,
  inputSchema: Record<string, any>,
  handler: (args: any, extra: unknown) => Promise<any>,
  extras?: any,
) => ReturnType<typeof sdkTool>;

// --- Canonical tool definition ---

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ZodType<any>;
  execute: (args: any) => Promise<any>;
}

// --- Kai conversion (ToolDefinition[] → Record<string, VercelTool>) ---

export function toKaiTools(defs: ToolDefinition[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const def of defs) {
    // Use inputSchema (not parameters) — matches Vercel AI SDK v4 overload
    result[def.name] = kaiTool({
      description: def.description,
      inputSchema: def.parameters,
      execute: def.execute,
    });
  }
  return result;
}

// --- Claude conversion (ToolDefinition[] → in-process MCP server) ---

export function toClaudeMcpServer(
  name: string,
  defs: ToolDefinition[]
): ReturnType<typeof createSdkMcpServer> | null {
  if (defs.length === 0) return null;

  const tools = defs.map((def) =>
    claudeTool(def.name, def.description, def.parameters, async (args) => {
      const result = await def.execute(args);
      const text =
        typeof result === "string" ? result : JSON.stringify(result);
      return { content: [{ type: "text" as const, text }] };
    })
  );

  return createSdkMcpServer({ name, version: "1.0.0", tools });
}
