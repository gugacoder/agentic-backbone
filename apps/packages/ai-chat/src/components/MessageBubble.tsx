import type { Message } from "@ai-sdk/react";
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
  const roleClass = isUser ? "ai-chat-bubble-user" : "ai-chat-bubble-assistant";
  const rowClass = isUser ? "ai-chat-bubble-row ai-chat-bubble-row-user" : "ai-chat-bubble-row ai-chat-bubble-row-assistant";

  const hasParts = Array.isArray(message.parts) && message.parts.length > 0;

  return (
    <div className={rowClass}>
      <div className={["ai-chat-bubble", roleClass, className].filter(Boolean).join(" ")}>
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
