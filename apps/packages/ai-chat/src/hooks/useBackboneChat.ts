import { useChat } from "@ai-sdk/react";
import type { Message } from "@ai-sdk/react";

export type { Message };

export interface UseBackboneChatOptions {
  endpoint: string;
  token: string;
  sessionId: string;
  initialMessages?: Message[];
}

export function useBackboneChat(options: UseBackboneChatOptions) {
  return useChat({
    api: `${options.endpoint}/api/v1/ai/conversations/${options.sessionId}/messages?format=datastream`,
    headers: { Authorization: `Bearer ${options.token}` },
    initialMessages: options.initialMessages,
  });
}
