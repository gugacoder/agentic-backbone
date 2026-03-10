import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";

// --- Types ---

export type TranscriptionStatus = "queued" | "processing" | "completed" | "failed";

export interface TranscriptionSummary {
  id: string;
  original_name: string;
  file_size: number;
  language: string;
  status: TranscriptionStatus;
  duration: number | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface TranscriptionDetail extends TranscriptionSummary {
  result_text: string | null;
  result_segments: Segment[] | null;
}

export interface Segment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionList {
  items: TranscriptionSummary[];
  total: number;
  limit: number;
  offset: number;
}

interface TranscriptionCreated {
  id: string;
  status: "queued";
  original_name: string;
  file_size: number;
  language: string;
  created_at: string;
}

// --- Queries ---

export function transcriptionsQuery() {
  return queryOptions({
    queryKey: ["transcriptions"],
    queryFn: () => api.get<TranscriptionList>("/transcriptions"),
  });
}

export function transcriptionDetailQuery(id: string) {
  return queryOptions({
    queryKey: ["transcriptions", id],
    queryFn: () => api.get<TranscriptionDetail>(`/transcriptions/${id}`),
    enabled: !!id,
  });
}

// --- Mutations ---

interface UploadOptions {
  file: File;
  language: string;
  onProgress?: (percent: number) => void;
}

export function useUploadTranscription() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ file, language, onProgress }: UploadOptions): Promise<TranscriptionCreated> => {
      return new Promise((resolve, reject) => {
        const token = useAuthStore.getState().token;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("language", language);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/v2/agents/transcribe");

        if (token) {
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        }

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress?.(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status === 401) {
            useAuthStore.getState().logout();
            const redirect = encodeURIComponent(window.location.pathname);
            window.location.href = `/hub/login?redirect=${redirect}`;
            reject(new Error("Session expired"));
            return;
          }

          try {
            const body = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(body);
            } else {
              reject(new Error(body.error ?? `Erro ${xhr.status}`));
            }
          } catch {
            reject(new Error(`Erro ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Erro de rede"));
        xhr.ontimeout = () => reject(new Error("Timeout"));

        xhr.send(formData);
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transcriptions"] });
    },
  });
}

export function useDeleteTranscription() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/transcriptions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transcriptions"] });
    },
  });
}
