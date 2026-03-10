import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AudioLines,
  Upload,
  Copy,
  Loader2,
  ChevronRight,
  Trash2,
  Download,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useSSE } from "@/hooks/use-sse";
import {
  transcriptionsQuery,
  transcriptionDetailQuery,
  useUploadTranscription,
  useDeleteTranscription,
  type TranscriptionSummary,
} from "@/api/transcriptions";
import { cn } from "@/lib/utils";

// --- Constants ---

const ALLOWED_EXTENSIONS = ["mp3", "mp4", "m4a", "wav", "webm", "ogg", "flac", "mpeg", "mpga"];
const ACCEPT = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");

const STATUS_LABEL: Record<string, string> = {
  queued: "pendente",
  processing: "processando",
  completed: "concluido",
  failed: "falha",
};

const STATUS_BADGE_MAP: Record<string, string> = {
  queued: "pending",
  processing: "running",
  completed: "completed",
  failed: "failed",
};

// --- Helpers ---

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `${diffMins}min atras`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h atras`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d atras`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

// --- Main Page ---

export function TranscribePage() {
  const qc = useQueryClient();

  // --- SSE Integration ---
  useSSE({
    url: "/system/events",
    onEvent: (event) => {
      if (event === "transcription:status") {
        qc.invalidateQueries({ queryKey: ["transcriptions"] });
      }
    },
  });

  // --- Data ---
  const { data: listData } = useQuery(transcriptionsQuery());
  const items = listData?.items ?? [];

  const inProgress = items.filter((t) => t.status === "queued" || t.status === "processing");
  const history = items.filter((t) => t.status === "completed" || t.status === "failed");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transcricao de Audio"
        description="Transcreva audios usando o Whisper"
      />

      {/* Upload Zone */}
      <UploadZone />

      {/* Em Andamento */}
      {inProgress.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Em andamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {inProgress.map((t) => (
              <InProgressItem key={t.id} item={t} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Historico */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Historico
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <EmptyState
              icon={AudioLines}
              title="Nenhuma transcricao"
              description="Envie um arquivo de audio para comecar"
            />
          ) : (
            <div className="space-y-2">
              {history.map((t) => (
                <HistoryItem key={t.id} item={t} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Upload Zone ---

function UploadZone() {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("pt");
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioUrlRef = useRef<string | null>(null);

  const upload = useUploadTranscription();

  const handleFile = useCallback((f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error(`Formato nao suportado: .${ext}`);
      return;
    }
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = URL.createObjectURL(f);
    setFile(f);
  }, []);

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragOver(false), []);

  const onFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const transcribe = useCallback(() => {
    if (!file) return;
    setUploadProgress(0);

    upload.mutate(
      {
        file,
        language,
        onProgress: (p) => setUploadProgress(p),
      },
      {
        onSuccess: () => {
          toast.success("Audio enviado para transcricao");
          setFile(null);
          if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
          }
          setUploadProgress(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        },
        onError: (err) => {
          toast.error(err.message);
          setUploadProgress(null);
        },
      }
    );
  }, [file, language, upload]);

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Dropzone */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors",
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          )}
        >
          <Upload className="h-10 w-10 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">Arraste um arquivo de audio aqui</p>
            <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground mt-2">{ALLOWED_EXTENSIONS.join(", ")}</p>
          </div>
          <input ref={fileInputRef} type="file" accept={ACCEPT} onChange={onFileSelect} className="hidden" />
        </div>

        {/* Selected file + audio preview */}
        {file && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <AudioLines className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate font-medium">{file.name}</span>
              <span className="text-muted-foreground shrink-0">{formatFileSize(file.size)}</span>
            </div>
            {audioUrlRef.current && (
              <audio controls src={audioUrlRef.current} className="w-full" />
            )}
          </div>
        )}

        {/* Controls */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Idioma:</span>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt">Portugues</SelectItem>
                <SelectItem value="en">Ingles</SelectItem>
                <SelectItem value="es">Espanhol</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={transcribe} disabled={!file || upload.isPending}>
            {upload.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Enviando...
              </>
            ) : (
              "Transcrever"
            )}
          </Button>
        </div>

        {/* Upload progress bar */}
        {upload.isPending && uploadProgress !== null && uploadProgress < 100 && (
          <div className="mt-4 space-y-1">
            <p className="text-sm text-muted-foreground">Enviando arquivo... {uploadProgress}%</p>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- In Progress Item ---

function InProgressItem({ item }: { item: TranscriptionSummary }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      {item.status === "processing" ? (
        <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
      ) : (
        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      <span className="truncate text-sm font-medium flex-1">{item.original_name}</span>
      <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(item.file_size)}</span>
      <StatusBadge status={STATUS_BADGE_MAP[item.status] ?? item.status} />
    </div>
  );
}

// --- History Item ---

function HistoryItem({ item }: { item: TranscriptionSummary }) {
  const [open, setOpen] = useState(false);

  const isCompleted = item.status === "completed";
  const isFailed = item.status === "failed";

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left">
          <ChevronRight className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", open && "rotate-90")} />
          {isCompleted && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
          {isFailed && <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />}
          <span className="truncate text-sm font-medium flex-1">{item.original_name}</span>
          {isCompleted && item.duration != null && (
            <span className="text-xs text-muted-foreground shrink-0">{formatDuration(item.duration)}</span>
          )}
          <span className="text-xs text-muted-foreground shrink-0">{item.language}</span>
          <StatusBadge status={STATUS_BADGE_MAP[item.status] ?? item.status} />
          <span className="text-xs text-muted-foreground shrink-0">{formatRelativeDate(item.created_at)}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {isCompleted && <CompletedDetail id={item.id} originalName={item.original_name} />}
        {isFailed && <FailedDetail id={item.id} error={item.error} />}
      </CollapsibleContent>
    </Collapsible>
  );
}

// --- Completed Detail ---

function CompletedDetail({ id, originalName }: { id: string; originalName: string }) {
  const { data: detail } = useQuery(transcriptionDetailQuery(id));
  const [showSegments, setShowSegments] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteMut = useDeleteTranscription();

  const copyText = useCallback(async () => {
    if (!detail?.result_text) return;
    await navigator.clipboard.writeText(detail.result_text);
    toast.success("Transcricao copiada!");
  }, [detail?.result_text]);

  const downloadTxt = useCallback(() => {
    if (!detail?.result_text) return;
    const blob = new Blob([detail.result_text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = originalName.replace(/\.[^.]+$/, ".txt");
    a.click();
    URL.revokeObjectURL(url);
  }, [detail?.result_text, originalName]);

  if (!detail) {
    return (
      <div className="px-10 pb-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-10 pb-3 space-y-3">
      {/* Transcription text */}
      {detail.result_text && (
        <pre className="whitespace-pre-wrap font-mono text-sm bg-muted/50 rounded-lg p-4 max-h-72 overflow-y-auto">
          {detail.result_text}
        </pre>
      )}

      {/* Segments toggle */}
      {detail.result_segments && detail.result_segments.length > 0 && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setShowSegments(!showSegments)} className="gap-1">
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", showSegments && "rotate-90")} />
            Segmentos ({detail.result_segments.length})
          </Button>
          {showSegments && (
            <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
              {detail.result_segments.map((seg, i) => (
                <div key={i} className="flex gap-3 text-sm py-1 px-2 rounded hover:bg-muted/50">
                  <span className="text-muted-foreground font-mono shrink-0">
                    {formatTimestamp(seg.start)} - {formatTimestamp(seg.end)}
                  </span>
                  <span>{seg.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={copyText}>
          <Copy className="h-3.5 w-3.5 mr-1" />
          Copiar
        </Button>
        <Button variant="outline" size="sm" onClick={downloadTxt}>
          <Download className="h-3.5 w-3.5 mr-1" />
          Download .txt
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/v2/agents/transcriptions/${id}/audio`} download>
            <AudioLines className="h-3.5 w-3.5 mr-1" />
            Download audio
          </a>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Deletar transcricao"
        description={`Deletar "${originalName}" permanentemente? O audio e o texto serao removidos.`}
        confirmText="Deletar"
        variant="destructive"
        onConfirm={() => deleteMut.mutate(id)}
      />
    </div>
  );
}

// --- Failed Detail ---

function FailedDetail({ id, error }: { id: string; error: string | null }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteMut = useDeleteTranscription();

  return (
    <div className="px-10 pb-3 space-y-3">
      <p className="text-sm text-destructive">{error ?? "Erro desconhecido"}</p>
      <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
        <Trash2 className="h-3.5 w-3.5 mr-1" />
        Deletar
      </Button>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Deletar transcricao"
        description="Deletar esta transcricao falhada?"
        confirmText="Deletar"
        variant="destructive"
        onConfirm={() => deleteMut.mutate(id)}
      />
    </div>
  );
}
