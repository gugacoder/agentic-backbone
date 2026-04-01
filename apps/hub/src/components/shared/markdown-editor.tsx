import { useState, useCallback, useRef, useEffect } from "react";
import Markdown from "react-markdown";
import { Eye, Pencil, Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  saveStatus: SaveStatus;
  placeholder?: string;
  minHeight?: number;
  onPreviewChange?: (preview: boolean) => void;
}

export function MarkdownEditor({
  value,
  onChange,
  saveStatus,
  placeholder = "Escreva em markdown...",
  minHeight = 400,
  onPreviewChange,
}: MarkdownEditorProps) {
  const [preview, setPreview] = useState(true);

  const togglePreview = (val: boolean) => {
    setPreview(val);
    onPreviewChange?.(val);
  };
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!preview && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [preview]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant={preview ? "secondary" : "ghost"}
            size="sm"
            onClick={() => togglePreview(true)}
          >
            <Eye className="size-3.5" />
            <span className="ml-1">Preview</span>
          </Button>
          <Button
            variant={preview ? "ghost" : "secondary"}
            size="sm"
            onClick={() => togglePreview(false)}
          >
            <Pencil className="size-3.5" />
            <span className="ml-1">Editar</span>
          </Button>
        </div>

        <SaveStatusIndicator status={saveStatus} />
      </div>

      {/* Editor / Preview */}
      {preview ? (
        <div
          className="prose prose-sm dark:prose-invert max-w-none overflow-auto rounded-md border bg-background p-4"
          style={{ minHeight }}
        >
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <p className="text-muted-foreground italic">Nenhum conteudo</p>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full resize-y rounded-md border bg-background p-4 font-mono text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          style={{ minHeight }}
        />
      )}
    </div>
  );
}

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {status === "saving" && (
        <>
          <Loader2 className="size-3 animate-spin" />
          Salvando...
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="size-3 text-green-600" />
          Salvo
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="size-3 text-destructive" />
          Erro ao salvar
        </>
      )}
    </span>
  );
}
