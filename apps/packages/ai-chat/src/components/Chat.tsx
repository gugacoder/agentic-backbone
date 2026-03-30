import React from "react";
import { cn } from "../lib/utils.js";
import { ChatProvider } from "../hooks/ChatProvider.js";
import { useChatContext } from "../hooks/ChatProvider.js";
import { MessageList } from "./MessageList.js";
import { MessageInput } from "./MessageInput.js";
import type { DisplayRendererMap } from "../display/registry.js";

export interface ChatProps {
  endpoint: string;
  token: string;
  sessionId: string;
  initialMessages?: Array<{ id?: string; role: "user" | "assistant"; content: string; parts?: unknown[] }>;
  displayRenderers?: DisplayRendererMap;
  placeholder?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

interface ChatContentProps {
  displayRenderers?: DisplayRendererMap;
  placeholder?: string;
}

function ChatContent({ displayRenderers, placeholder }: ChatContentProps) {
  const { messages, input, setInput, handleSubmit, isLoading, stop } = useChatContext();
  return (
    <>
      <MessageList messages={messages} isLoading={isLoading} displayRenderers={displayRenderers} />
      <div className="px-4 pb-4">
        <MessageInput
          input={input}
          setInput={setInput}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
          stop={stop}
          placeholder={placeholder}
        />
      </div>
    </>
  );
}

export function Chat({
  endpoint,
  token,
  sessionId,
  initialMessages,
  displayRenderers,
  placeholder,
  header,
  footer,
  className,
}: ChatProps) {
  return (
    <ChatProvider key={sessionId} endpoint={endpoint} token={token} sessionId={sessionId} initialMessages={initialMessages as any}>
      <div className={cn("flex flex-col h-full bg-background text-foreground", className)}>
        {header}
        <ChatContent displayRenderers={displayRenderers} placeholder={placeholder} />
        {footer}
      </div>
    </ChatProvider>
  );
}
