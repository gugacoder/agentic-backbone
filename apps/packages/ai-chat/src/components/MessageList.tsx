import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { useRef, useEffect } from "react";
import type { Message } from "@ai-sdk/react";
import { MessageBubble } from "./MessageBubble.js";
import type { DisplayRendererMap } from "../display/registry.js";
import { ScrollBar } from "../ui/scroll-area.js";
import { cn } from "../lib/utils.js";

export interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  displayRenderers?: DisplayRendererMap;
  className?: string;
}

export function MessageList({ messages, isLoading, displayRenderers, className }: MessageListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

    if (distanceFromBottom <= 100) {
      anchorRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const lastAssistantIndex = messages.reduceRight((found, msg, i) => {
    if (found !== -1) return found;
    return msg.role === "assistant" ? i : -1;
  }, -1);

  return (
    <ScrollAreaPrimitive.Root className={cn("flex-1 relative overflow-hidden", className)}>
      <ScrollAreaPrimitive.Viewport ref={viewportRef} className="h-full w-full rounded-[inherit]">
        <div className="flex flex-col gap-3 p-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center text-muted-foreground text-sm py-8">
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
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}
