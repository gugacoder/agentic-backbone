import { useChat } from "@ai-sdk/react";
import { useRef, useEffect, useState, useCallback } from "react";
import type { Message } from "@ai-sdk/react";
import type React from "react";

export type { Message };

const RESPONSE_TIMEOUT_MS = 30_000;

export interface UseBackboneChatOptions {
  endpoint: string;
  token: string;
  sessionId: string;
  initialMessages?: Message[];
  enableRichContent?: boolean;
}

export function useBackboneChat(options: UseBackboneChatOptions) {
  const [syntheticError, setSyntheticError] = useState<Error | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLoadingRef = useRef(false);
  const pendingFilesRef = useRef<File[]>([]);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const rich = options.enableRichContent !== false;
  const chat = useChat({
    api: `${options.endpoint}/api/v1/ai/conversations/${options.sessionId}/messages?format=datastream${rich ? "&rich=true" : ""}`,
    headers: { Authorization: `Bearer ${options.token}` },
    initialMessages: options.initialMessages,
    fetch: async (url: string | URL | Request, init?: RequestInit) => {
      if (pendingFilesRef.current.length > 0) {
        const files = pendingFilesRef.current;
        pendingFilesRef.current = [];

        const body = JSON.parse((init?.body as string) || "{}");
        const messages: Array<{ role: string; content: unknown }> = body.messages ?? [];
        const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
        const messageText = typeof lastUserMsg?.content === "string" ? lastUserMsg.content : "";

        const formData = new FormData();
        if (messageText) formData.append("message", messageText);
        for (const file of files) {
          formData.append("files", file);
        }

        const initHeaders = new Headers((init?.headers ?? {}) as HeadersInit);
        initHeaders.delete("Content-Type");

        const res = await fetch(url, {
          method: "POST",
          headers: initHeaders,
          body: formData,
        });

        if (!res.ok) {
          let errorMsg = `Erro ${res.status}`;
          try {
            const text = await res.text();
            if (text) errorMsg = text;
          } catch { /* ignore */ }
          throw new Error(errorMsg);
        }

        return res;
      }
      return fetch(url, init);
    },
    onError: () => {
      clearTimer();
      setIsUploading(false);
      setSyntheticError(null);
    },
    onFinish: () => {
      clearTimer();
      setIsUploading(false);
      setSyntheticError(null);
    },
  });

  const buildAttachmentUrl = useCallback((ref: string) => {
    const base = `${options.endpoint}/api/v1/ai/conversations/${options.sessionId}/attachments/${encodeURIComponent(ref)}`;
    return options.token ? `${base}?token=${encodeURIComponent(options.token)}` : base;
  }, [options.endpoint, options.sessionId, options.token]);

  const { isLoading, messages, stop } = chat;

  // --- Camada 2: timeout de resposta ---
  // Inicia timer quando começa a carregar; reseta a cada chunk recebido
  useEffect(() => {
    if (isLoading) {
      clearTimer();
      timeoutRef.current = setTimeout(() => {
        stop();
        setSyntheticError(new Error("Tempo limite atingido. O servidor nao respondeu."));
      }, RESPONSE_TIMEOUT_MS);
    } else {
      clearTimer();
    }
    return clearTimer;
  }, [isLoading, stop, clearTimer]);

  // Reset timeout quando mensagens mudam (dados chegando)
  useEffect(() => {
    if (isLoading && messages.length > 0) {
      clearTimer();
      timeoutRef.current = setTimeout(() => {
        stop();
        setSyntheticError(new Error("Tempo limite atingido. O servidor nao respondeu."));
      }, RESPONSE_TIMEOUT_MS);
    }
  }, [messages, isLoading, stop, clearTimer]);

  // --- Camada 3: deteccao de resposta vazia ---
  useEffect(() => {
    if (prevLoadingRef.current && !isLoading) {
      const lastMessage = messages[messages.length - 1];
      if (!chat.error && lastMessage?.role === "user") {
        setSyntheticError(new Error("Nenhuma resposta recebida. Tente novamente."));
      }
    }
    prevLoadingRef.current = isLoading;
  }, [isLoading, messages, chat.error]);

  const error = chat.error ?? syntheticError;

  const handleSubmit = useCallback((e: React.FormEvent, attachments?: Array<{ file: File }>) => {
    setSyntheticError(null);
    if (attachments && attachments.length > 0) {
      pendingFilesRef.current = attachments.map((a) => a.file);
      setIsUploading(true);
    }
    return chat.handleSubmit(e as React.FormEvent<HTMLFormElement>);
  }, [chat.handleSubmit]);

  const reload = useCallback((...args: Parameters<typeof chat.reload>) => {
    setSyntheticError(null);
    return chat.reload(...args);
  }, [chat.reload]);

  return { ...chat, error, handleSubmit, reload, isUploading, buildAttachmentUrl };
}
