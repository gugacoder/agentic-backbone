import { Markdown } from "../components/Markdown.js";
import { ReasoningBlock } from "./ReasoningBlock.js";
import { ToolActivity } from "./ToolActivity.js";
import { ToolResult } from "./ToolResult.js";
import { resolveDisplayRenderer } from "../display/registry.js";
import type { DisplayRendererMap } from "../display/registry.js";

// Minimal part types — mirrors @ai-sdk/react Message["parts"]
type TextPart = { type: "text"; text: string };
type ReasoningPart = { type: "reasoning"; reasoning: string };
type ToolInvocationPart = {
  type: "tool-invocation";
  toolInvocation: {
    toolName: string;
    state: "call" | "partial-call" | "result";
    result?: unknown;
  };
};
type MessagePart = TextPart | ReasoningPart | ToolInvocationPart | { type: string };

export interface PartRendererProps {
  part: MessagePart;
  isStreaming?: boolean;
  displayRenderers?: DisplayRendererMap;
}

export function PartRenderer({ part, isStreaming, displayRenderers }: PartRendererProps) {
  switch (part.type) {
    case "text": {
      const p = part as TextPart;
      return <Markdown>{p.text}</Markdown>;
    }

    case "reasoning": {
      const p = part as ReasoningPart;
      return <ReasoningBlock content={p.reasoning} isStreaming={isStreaming} />;
    }

    case "tool-invocation": {
      const { toolInvocation } = part as ToolInvocationPart;
      const isDisplay = toolInvocation.toolName.startsWith("display_");

      if (isDisplay && toolInvocation.state === "result") {
        const Renderer = resolveDisplayRenderer(toolInvocation.toolName, displayRenderers);
        if (Renderer) return <Renderer {...(toolInvocation.result as Record<string, unknown>)} />;
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
        />
      );
    }

    default:
      return null;
  }
}
