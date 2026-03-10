import { useAuthStore } from "./auth";
import type { AgentEvent } from "@/api/types";

interface StreamCallbacks {
  onText: (chunk: string) => void;
  onDone: (fullText: string) => void;
  onError: (err: Error) => void;
}

export async function streamMessage(
  sessionId: string,
  message: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  files?: File[]
) {
  let res: Response;

  try {
    const token = useAuthStore.getState().token;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    let body: BodyInit;
    if (files && files.length > 0) {
      const form = new FormData();
      form.append("message", message);
      for (const file of files) {
        form.append("file", file);
      }
      body = form;
      // No Content-Type header — browser sets multipart boundary automatically
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify({ message });
    }

    res = await fetch(`/api/v2/agents/conversations/${sessionId}/messages`, {
      method: "POST",
      headers,
      body,
      signal,
    });
  } catch (err) {
    if (signal?.aborted) return;
    callbacks.onError(
      err instanceof Error ? err : new Error("Falha na conexão com o servidor")
    );
    return;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    callbacks.onError(new Error(body.error ?? res.statusText));
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError(new Error("No response body"));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const json = line.slice(5).trim();
        if (!json) continue;

        try {
          const event = JSON.parse(json) as { type: string; content?: string };

          if (event.type === "text" && event.content) {
            fullText += event.content;
            callbacks.onText(event.content);
          }

          if (event.type === "result" && event.content) {
            fullText = event.content;
          }

          if (event.type === "error" && event.content) {
            callbacks.onError(new Error(event.content));
            return;
          }
        } catch {
          // ignore malformed JSON
        }
      }
    }

    callbacks.onDone(fullText);
  } catch (err) {
    if (signal?.aborted) return;
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }
}
