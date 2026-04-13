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
  enableAttachments?: boolean;
  enableVoice?: boolean;
  /** Ativa rich content (display tools) no stream. Default: true */
  enableRichContent?: boolean;
}

interface ChatContentProps {
  displayRenderers?: DisplayRendererMap;
  placeholder?: string;
  enableAttachments?: boolean;
  enableVoice?: boolean;
}

function ChatContent({ displayRenderers, placeholder, enableAttachments = true, enableVoice = true }: ChatContentProps) {
  const { messages, input, setInput, handleSubmit, isLoading, isUploading, stop, error, reload, buildAttachmentUrl } = useChatContext();

  return (
    <>
      <MessageList messages={messages} isLoading={isLoading} displayRenderers={displayRenderers} attachmentUrl={buildAttachmentUrl} error={error ?? undefined} onRetry={reload} />
      <div className="px-4 pb-4">
        <MessageInput
          input={input}
          setInput={setInput}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
          isUploading={isUploading}
          stop={stop}
          placeholder={placeholder}
          enableAttachments={enableAttachments}
          enableVoice={enableVoice}
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
  enableAttachments,
  enableVoice,
  enableRichContent,
}: ChatProps) {
  return (
    <ChatProvider key={sessionId} endpoint={endpoint} token={token} sessionId={sessionId} initialMessages={initialMessages as any} enableRichContent={enableRichContent}>
      <div className={cn("flex flex-col h-full bg-background text-foreground", className)}>
        {header}
        <ChatContent
          displayRenderers={displayRenderers}
          placeholder={placeholder}
          enableAttachments={enableAttachments}
          enableVoice={enableVoice}
        />
        {footer}
      </div>
    </ChatProvider>
  );
}
