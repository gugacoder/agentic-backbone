import React from "react";
import { ChatProvider } from "../hooks/ChatProvider.js";
import { useChatContext } from "../hooks/ChatProvider.js";
import { MessageList } from "./MessageList.js";
import { MessageInput } from "./MessageInput.js";
import type { DisplayRendererMap } from "../display/registry.js";

export interface ChatProps {
  endpoint: string;
  token: string;
  sessionId: string;
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
      <MessageInput
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
        stop={stop}
        placeholder={placeholder}
      />
    </>
  );
}

export function Chat({
  endpoint,
  token,
  sessionId,
  displayRenderers,
  placeholder,
  header,
  footer,
  className,
}: ChatProps) {
  const rootClass = ["ai-chat", className].filter(Boolean).join(" ");
  return (
    <ChatProvider endpoint={endpoint} token={token} sessionId={sessionId}>
      <div className={rootClass}>
        {header}
        <ChatContent displayRenderers={displayRenderers} placeholder={placeholder} />
        {footer}
      </div>
    </ChatProvider>
  );
}
