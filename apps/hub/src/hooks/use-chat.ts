import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { conversationMessagesQuery } from "@/api/conversations";
import { streamMessage } from "@/lib/chat-stream";
import type { ChatMessage } from "@/api/types";

export function useChat(sessionId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const qc = useQueryClient();

  const { data: history, isLoading } = useQuery({
    ...conversationMessagesQuery(sessionId ?? ""),
    enabled: !!sessionId,
  });

  useEffect(() => {
    if (history) {
      setMessages(history);
    }
  }, [history]);

  // Reset state when sessionId changes
  useEffect(() => {
    setMessages([]);
    setStreamingText("");
    setIsStreaming(false);
    abortRef.current?.abort();
    abortRef.current = null;
  }, [sessionId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!sessionId || isStreaming) return;

      // Optimistic user message
      const userMsg: ChatMessage = {
        ts: new Date().toISOString(),
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      setStreamingText("");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamMessage(
          sessionId,
          text,
          {
            onText: (chunk) => {
              setStreamingText((prev) => prev + chunk);
            },
            onDone: (fullText) => {
              const assistantMsg: ChatMessage = {
                ts: new Date().toISOString(),
                role: "assistant",
                content: fullText,
              };
              setMessages((prev) => [...prev, assistantMsg]);
              setStreamingText("");
              setIsStreaming(false);
              abortRef.current = null;
              // Invalidate to sync with server
              qc.invalidateQueries({ queryKey: ["conversations", sessionId, "messages"] });
              qc.invalidateQueries({ queryKey: ["conversations"] });
            },
            onError: (err) => {
              const errorMsg: ChatMessage = {
                ts: new Date().toISOString(),
                role: "assistant",
                content: `Desculpe, não foi possível processar sua mensagem. ${err.message || "Tente novamente."}`,
              };
              setMessages((prev) => [...prev, errorMsg]);
              setStreamingText("");
              setIsStreaming(false);
              abortRef.current = null;
            },
          },
          controller.signal
        );
      } catch {
        // Safety net — nunca deve chegar aqui, mas garante feedback
        const errorMsg: ChatMessage = {
          ts: new Date().toISOString(),
          role: "assistant",
          content: "Desculpe, ocorreu um erro inesperado. Tente novamente.",
        };
        setMessages((prev) => [...prev, errorMsg]);
        setStreamingText("");
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [sessionId, isStreaming, qc]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    if (streamingText) {
      const assistantMsg: ChatMessage = {
        ts: new Date().toISOString(),
        role: "assistant",
        content: streamingText,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    }

    setStreamingText("");
    setIsStreaming(false);
  }, [streamingText]);

  return { messages, isStreaming, isLoading, streamingText, sendMessage, stopStreaming };
}
