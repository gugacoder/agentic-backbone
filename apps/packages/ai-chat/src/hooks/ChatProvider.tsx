import React, { createContext, useContext } from "react";
import { useBackboneChat, type UseBackboneChatOptions } from "./useBackboneChat.js";

type ChatContextValue = ReturnType<typeof useBackboneChat>;

const ChatContext = createContext<ChatContextValue | null>(null);

export interface ChatProviderProps extends Omit<UseBackboneChatOptions, "initialMessages"> {
  initialMessages?: UseBackboneChatOptions["initialMessages"];
  children: React.ReactNode;
}

export function ChatProvider({ endpoint, token, sessionId, initialMessages, enableRichContent, children }: ChatProviderProps) {
  const chat = useBackboneChat({ endpoint, token, sessionId, initialMessages, enableRichContent });
  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}
