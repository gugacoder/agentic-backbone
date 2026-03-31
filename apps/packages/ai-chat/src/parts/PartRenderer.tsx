import { memo } from "react";
import { Markdown } from "../components/Markdown.js";
import { LazyRender } from "../components/LazyRender.js";
import { ReasoningBlock } from "./ReasoningBlock.js";
import { ToolActivity } from "./ToolActivity.js";
import { ToolResult } from "./ToolResult.js";
import { resolveDisplayRenderer } from "../display/registry.js";
import type { DisplayRendererMap } from "../display/registry.js";

const HEAVY_RENDERERS = new Set([
  "display_chart", "display_map", "display_table",
  "display_spreadsheet", "display_gallery", "display_image",
]);

// Minimal part types — mirrors @ai-sdk/react Message["parts"]
type TextPart = { type: "text"; text: string };
type ReasoningPart = { type: "reasoning"; reasoning: string };
type ToolInvocationPart = {
  type: "tool-invocation";
  toolInvocation: {
    toolName: string;
    toolCallId?: string;
    state: "call" | "partial-call" | "result";
    args?: Record<string, unknown>;
    result?: unknown;
  };
};
type MessagePart = TextPart | ReasoningPart | ToolInvocationPart | { type: string };

export interface PartRendererProps {
  part: MessagePart;
  isStreaming?: boolean;
  displayRenderers?: DisplayRendererMap;
  keepReasoning?: boolean;
}

export const PartRenderer = memo(function PartRenderer({ part, isStreaming, displayRenderers, keepReasoning }: PartRendererProps) {
  switch (part.type) {
    case "text": {
      const p = part as TextPart;
      return <Markdown>{p.text}</Markdown>;
    }

    case "reasoning": {
      const p = part as ReasoningPart;
      if (!keepReasoning && !isStreaming) return null;
      return <ReasoningBlock content={p.reasoning} isStreaming={isStreaming} />;
    }

    case "tool-invocation": {
      const { toolInvocation } = part as ToolInvocationPart;
      const isDisplay = toolInvocation.toolName.startsWith("display_");

      if (isDisplay && toolInvocation.state === "result") {
        const Renderer = resolveDisplayRenderer(toolInvocation.toolName, displayRenderers);
        if (Renderer) {
          const rendered = <Renderer {...(toolInvocation.result as Record<string, unknown>)} />;
          if (!isStreaming && HEAVY_RENDERERS.has(toolInvocation.toolName)) {
            return <LazyRender>{rendered}</LazyRender>;
          }
          return rendered;
        }
      }

      if (toolInvocation.state === "result") {
        return (
          <ToolResult
            toolName={toolInvocation.toolName}
            result={toolInvocation.result}
          />
        );
      }

      return (
        <ToolActivity
          toolName={toolInvocation.toolName}
          state={toolInvocation.state}
          args={toolInvocation.args}
        />
      );
    }

    default:
      return null;
  }
});
