import { memo } from "react";
import type { Message } from "@ai-sdk/react";
import { cn } from "../lib/utils.js";
import { Markdown } from "./Markdown.js";
import { StreamingIndicator } from "./StreamingIndicator.js";
import { PartRenderer } from "../parts/PartRenderer.js";
import type { DisplayRendererMap } from "../display/registry.js";

export interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  displayRenderers?: DisplayRendererMap;
  className?: string;
}

export const MessageBubble = memo(function MessageBubble({ message, isStreaming, displayRenderers, className }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const hasParts = Array.isArray(message.parts) && message.parts.length > 0;

  return (
    <div className={isUser ? "flex w-full justify-end" : "w-full"}>
      <div
        className={cn(
          "min-w-0 overflow-hidden",
          isUser
            ? "max-w-[80%] rounded-lg rounded-br-sm bg-muted/30 text-foreground px-4 py-2.5"
            : "text-foreground py-1",
          className
        )}
      >
        {hasParts
          ? <div className="flex flex-col gap-3">
              {(message.parts as { type: string }[]).map((part, i) => (
                <PartRenderer
                  key={i}
                  part={part as Parameters<typeof PartRenderer>[0]["part"]}
                  isStreaming={isStreaming}
                  displayRenderers={displayRenderers}
                />
              ))}
            </div>
          : <Markdown>{message.content}</Markdown>
        }
        {isStreaming && !isUser && <StreamingIndicator />}
      </div>
    </div>
  );
}, (prev, next) =>
  prev.message === next.message
  && prev.isStreaming === next.isStreaming
  && prev.displayRenderers === next.displayRenderers
  && prev.className === next.className
);
