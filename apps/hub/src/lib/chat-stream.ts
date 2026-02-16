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
  signal?: AbortSignal
) {
  let res: Response;

  try {
    const token = useAuthStore.getState().token;

    res = await fetch(`/api/conversations/${sessionId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message }),
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
          const event: AgentEvent = JSON.parse(json);

          if (event.type === "text" && event.content) {
            fullText += event.content;
            callbacks.onText(event.content);
          }

          if (event.type === "result" && event.content) {
            fullText = event.content;
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
