import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { useRef, useEffect, useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
  const isFollowingRef = useRef(true);

  const lastAssistantIndex = useMemo(() =>
    messages.reduceRight((found, msg, i) => {
      if (found !== -1) return found;
      return msg.role === "assistant" ? i : -1;
    }, -1),
    [messages]
  );

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => 80,
    overscan: 5,
    paddingStart: 16,
  });

  // Track scroll position to detect if user is following
  const handleScroll = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    isFollowingRef.current = distanceFromBottom <= 100;
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Auto-scroll to bottom when following
  useEffect(() => {
    if (messages.length > 0 && isFollowingRef.current) {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    }
  }, [messages, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();

  if (messages.length === 0) {
    return (
      <ScrollAreaPrimitive.Root className={cn("flex-1 relative overflow-hidden", className)}>
        <ScrollAreaPrimitive.Viewport ref={viewportRef} className="h-full w-full rounded-[inherit]">
          <div className="flex items-center justify-center text-muted-foreground text-sm py-8">
            Envie uma mensagem para comecar
          </div>
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar />
        <ScrollAreaPrimitive.Corner />
      </ScrollAreaPrimitive.Root>
    );
  }

  return (
    <ScrollAreaPrimitive.Root className={cn("flex-1 relative overflow-hidden", className)}>
      <ScrollAreaPrimitive.Viewport ref={viewportRef} className="h-full w-full rounded-[inherit]">
        <div
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() + 16 }}
        >
          <div>
            {virtualItems.map((virtualRow) => {
              const message = messages[virtualRow.index];
              return (
                <div
                  key={message.id ?? virtualRow.index}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className="pb-3 px-4"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <MessageBubble
                    message={message}
                    isStreaming={virtualRow.index === lastAssistantIndex && isLoading}
                    displayRenderers={displayRenderers}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}
