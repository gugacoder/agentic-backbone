import { tool, type CoreTool } from "ai";
import { z } from "zod";

const MAX_OUTPUT = 50_000;

/**
 * Factory that creates the Batch tool for parallel tool execution.
 *
 * Receives the resolved tool registry so it can look up tools by name.
 * The Batch tool itself is excluded from the registry to prevent recursion.
 */
export function createBatchTool(toolRegistry: Record<string, CoreTool>) {
  // Build the list of available tool names (excluding Batch itself)
  const availableTools = Object.keys(toolRegistry).filter(
    (name) => name !== "Batch"
  );

  return tool({
    description:
      "Execute 2-10 tool calls simultaneously in parallel using Promise.allSettled(). " +
      "Partial failures do not cancel other calls. " +
      "Batch cannot call itself (no recursion). " +
      `Available tools: ${availableTools.join(", ")}`,
    parameters: z.object({
      tool_calls: z
        .array(
          z.object({
            tool: z
              .string()
              .describe("Name of the tool to call (must be a registered tool)"),
            parameters: z
              .record(z.any())
              .describe("Parameters to pass to the tool"),
          })
        )
        .min(2)
        .max(10)
        .describe("Array of tool calls to execute in parallel (2-10 items)"),
    }),
    execute: async ({ tool_calls }) => {
      // Validate: no Batch inside Batch
      const batchCalls = tool_calls.filter((tc) => tc.tool === "Batch");
      if (batchCalls.length > 0) {
        return "Error: Batch cannot call itself. Remove Batch from tool_calls.";
      }

      // Validate: all tools exist
      const unknownTools = tool_calls.filter(
        (tc) => !availableTools.includes(tc.tool)
      );
      if (unknownTools.length > 0) {
        const names = unknownTools.map((tc) => tc.tool).join(", ");
        return `Error: Unknown tool(s): ${names}. Available: ${availableTools.join(", ")}`;
      }

      // Execute all calls in parallel
      const promises = tool_calls.map(async (tc, index) => {
        const targetTool = toolRegistry[tc.tool] as CoreTool & {
          execute?: (params: Record<string, unknown>) => Promise<string>;
        };

        if (!targetTool.execute) {
          return { index, tool: tc.tool, result: `Error: Tool "${tc.tool}" has no execute function.` };
        }

        try {
          const result = await targetTool.execute(tc.parameters, {
            toolCallId: `batch-${index}-${tc.tool}`,
            messages: [],
            abortSignal: undefined as unknown as AbortSignal,
          });
          return { index, tool: tc.tool, result: String(result) };
        } catch (err: any) {
          return {
            index,
            tool: tc.tool,
            result: `Error: ${err.message ?? String(err)}`,
          };
        }
      });

      const settled = await Promise.allSettled(promises);

      const parts: string[] = [];
      for (const outcome of settled) {
        if (outcome.status === "fulfilled") {
          const { index, tool: toolName, result } = outcome.value;
          parts.push(`### [${index}] ${toolName}\n\n${result}`);
        } else {
          parts.push(`### [?] Error\n\n${outcome.reason?.message ?? String(outcome.reason)}`);
        }
      }

      let output = parts.join("\n\n---\n\n");

      if (output.length > MAX_OUTPUT) {
        output = output.slice(0, MAX_OUTPUT) + "\n...[truncated at 50KB]";
      }

      return output;
    },
  });
}
