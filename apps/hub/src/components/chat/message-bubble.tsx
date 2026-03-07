import { useState } from "react";
import Markdown from "react-markdown";
import { Copy, Check, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StreamingIndicator } from "./streaming-indicator";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  sessionId?: string;
  onTrace?: (sessionId: string) => void;
}

export function MessageBubble({ message, isStreaming, sessionId, onTrace }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  function handleCopy() {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={cn(
        "group flex w-full",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "relative max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <Markdown>{message.content}</Markdown>
            {isStreaming && <StreamingIndicator />}
          </div>
        )}

        {!isStreaming && message.content && (
          <div
            className={cn(
              "absolute -top-3 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100",
              isUser ? "-left-2" : "-right-2",
            )}
          >
            {!isUser && sessionId && onTrace && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                title="Ver trace"
                onClick={() => onTrace(sessionId)}
              >
                <Activity className="size-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="size-3" />
              ) : (
                <Copy className="size-3" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
