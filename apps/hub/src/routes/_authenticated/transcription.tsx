import { useState, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Mic, Upload, Loader2, Copy, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { request } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/transcription")({
  staticData: { title: "Transcrição", description: "Transcrição de áudio com Whisper" },
  component: TranscriptionPage,
});

interface TranscriptionResult {
  text: string;
  duration: number | null;
  model: string;
  language: string;
}

const LANGUAGES = [
  { value: "pt", label: "Português" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "ja", label: "日本語" },
  { value: "zh", label: "中文" },
];

function TranscriptionPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("pt");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [copied, setCopied] = useState(false);

  function handleFile(f: File) {
    setFile(f);
    setResult(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function handleTranscribe() {
    if (!file) return;
    setLoading(true);
    setResult(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("language", language);

      const token = localStorage.getItem("token");
      const res = await fetch("/api/transcriptions", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as TranscriptionResult;
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao transcrever");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClear() {
    setFile(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Transcrição de Áudio</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Transcreva arquivos de áudio usando Whisper.
        </p>
      </div>

      {/* Upload area */}
      <div
        className={cn(
          "rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
          dragOver ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/40",
          file && "border-muted bg-muted/30"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !file && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,video/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <Mic className="h-5 w-5 text-primary shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button
              className="ml-2 rounded-full p-1 hover:bg-muted"
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">Clique ou arraste um arquivo de áudio</p>
            <p className="text-xs text-muted-foreground">MP3, WAV, OGG, M4A, WebM e outros formatos</p>
          </div>
        )}
      </div>

      {/* Options */}
      <div className="flex items-end gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Idioma</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs invisible">_</Label>
          <Button onClick={handleTranscribe} disabled={!file || loading}>
            {loading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Transcrevendo...</>
              : <><Mic className="mr-2 h-4 w-4" /> Transcrever</>}
          </Button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Transcrição</p>
              {result.duration !== null && (
                <span className="text-xs text-muted-foreground">
                  {result.duration.toFixed(1)}s · modelo {result.model}
                </span>
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={handleCopy}>
              {copied
                ? <><Check className="mr-1.5 h-3.5 w-3.5" /> Copiado</>
                : <><Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar</>}
            </Button>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap rounded bg-muted p-3">
            {result.text || <span className="text-muted-foreground italic">(sem texto)</span>}
          </p>
        </div>
      )}
    </div>
  );
}
