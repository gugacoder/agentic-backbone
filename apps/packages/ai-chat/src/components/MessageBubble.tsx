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

export function MessageBubble({ message, isStreaming, displayRenderers, className }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const hasParts = Array.isArray(message.parts) && message.parts.length > 0;

  return (
    <div className={isUser ? "flex w-full justify-end" : "flex w-full justify-start"}>
      <div
        className={cn(
          "inline-block max-w-[80%] rounded-lg px-4 py-2.5",
          isUser
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted text-foreground",
          className
        )}
      >
        {hasParts
          ? (message.parts as { type: string }[]).map((part, i) => (
              <PartRenderer
                key={i}
                part={part as Parameters<typeof PartRenderer>[0]["part"]}
                isStreaming={isStreaming}
                displayRenderers={displayRenderers}
              />
            ))
          : <Markdown>{message.content}</Markdown>
        }
        {isStreaming && !isUser && <StreamingIndicator />}
      </div>
    </div>
  );
}
