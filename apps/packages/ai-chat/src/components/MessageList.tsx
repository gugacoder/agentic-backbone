import { useRef, useEffect } from "react";
import type { Message } from "@ai-sdk/react";
import { MessageBubble } from "./MessageBubble.js";
import type { DisplayRendererMap } from "../display/registry.js";

export interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  displayRenderers?: DisplayRendererMap;
  className?: string;
}

export function MessageList({ messages, isLoading, displayRenderers, className }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    if (distanceFromBottom <= 100) {
      anchorRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const lastAssistantIndex = messages.reduceRight((found, msg, i) => {
    if (found !== -1) return found;
    return msg.role === "assistant" ? i : -1;
  }, -1);

  return (
    <div
      ref={containerRef}
      className={["ai-chat-list", className].filter(Boolean).join(" ")}
    >
      {messages.length === 0 ? (
        <div className="ai-chat-list-empty">
          Envie uma mensagem para comecar
        </div>
      ) : (
        messages.map((message, i) => (
          <MessageBubble
            key={message.id ?? i}
            message={message}
            isStreaming={i === lastAssistantIndex && isLoading}
            displayRenderers={displayRenderers}
          />
        ))
      )}
      <div ref={anchorRef} />
    </div>
  );
}
