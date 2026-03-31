import React from "react";
import { cn } from "../lib/utils.js";
import { ChatProvider } from "../hooks/ChatProvider.js";
import { useChatContext } from "../hooks/ChatProvider.js";
import { MessageList } from "./MessageList.js";
import { MessageInput } from "./MessageInput.js";
import type { AgentEndpoint } from "./MessageInput.js";
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
  endpoints?: AgentEndpoint[];
  defaultAgent?: string;
  enableAttachments?: boolean;
  enableVoice?: boolean;
  keepReasoning?: boolean;
  showAgentSelector?: boolean;
  compactAgentSelector?: boolean;
}

interface ChatContentProps {
  displayRenderers?: DisplayRendererMap;
  placeholder?: string;
  endpoints?: AgentEndpoint[];
  defaultAgent?: string;
  enableAttachments?: boolean;
  enableVoice?: boolean;
  keepReasoning?: boolean;
  showAgentSelector?: boolean;
  compactAgentSelector?: boolean;
}

function ChatContent({ displayRenderers, placeholder, endpoints, defaultAgent, enableAttachments = false, enableVoice = false, keepReasoning = false, showAgentSelector = true, compactAgentSelector = false }: ChatContentProps) {
  const { messages, input, setInput, handleSubmit, isLoading, stop, error, reload } = useChatContext();
  const [activeAgent, setActiveAgent] = React.useState(defaultAgent ?? endpoints?.[0]?.id ?? "");

  return (
    <>
      <MessageList messages={messages} isLoading={isLoading} displayRenderers={displayRenderers} error={error ?? undefined} onRetry={reload} keepReasoning={keepReasoning} />
      <div className="px-4 pb-4">
        <MessageInput
          input={input}
          setInput={setInput}
          handleSubmit={handleSubmit as unknown as (e: React.FormEvent, attachments?: unknown[]) => void}
          isLoading={isLoading}
          stop={stop}
          placeholder={placeholder}
          enableAttachments={enableAttachments}
          enableVoice={enableVoice}
          endpoints={endpoints}
          activeEndpoint={activeAgent}
          onEndpointChange={setActiveAgent}
          showAgentSelector={showAgentSelector}
          compactAgentSelector={compactAgentSelector}
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
  endpoints,
  defaultAgent,
  enableAttachments,
  enableVoice,
  keepReasoning,
  showAgentSelector,
  compactAgentSelector,
}: ChatProps) {
  return (
    <ChatProvider key={sessionId} endpoint={endpoint} token={token} sessionId={sessionId} initialMessages={initialMessages as any}>
      <div className={cn("flex flex-col h-full bg-background text-foreground", className)}>
        {header}
        <ChatContent
          displayRenderers={displayRenderers}
          placeholder={placeholder}
          endpoints={endpoints}
          defaultAgent={defaultAgent}
          enableAttachments={enableAttachments}
          enableVoice={enableVoice}
          keepReasoning={keepReasoning}
          showAgentSelector={showAgentSelector}
          compactAgentSelector={compactAgentSelector}
        />
        {footer}
      </div>
    </ChatProvider>
  );
}
