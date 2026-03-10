import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizontal, Square, Paperclip, X } from "lucide-react";

interface MessageInputProps {
  onSend: (text: string, files?: File[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function MessageInput({ onSend, onStop, isStreaming, disabled }: MessageInputProps) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [text]);

  function handleSend() {
    const trimmed = text.trim();
    if ((!trimmed && files.length === 0) || isStreaming) return;
    onSend(trimmed || "Arquivo anexado", files.length > 0 ? files : undefined);
    setText("");
    setFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...selected]);
    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const canSend = (text.trim().length > 0 || files.length > 0) && !isStreaming && !disabled;

  return (
    <div className="border-t">
      {/* Attached files preview */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2">
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-1 text-xs bg-muted rounded-md px-2 py-1 max-w-[200px]"
            >
              <span className="truncate">{file.name}</span>
              <button
                onClick={() => removeFile(i)}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 p-3">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="audio/*,video/*,image/*,.pdf,.txt,.csv,.json"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Attach button */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-9 w-9"
          disabled={disabled || isStreaming}
          onClick={() => fileInputRef.current?.click()}
          title="Anexar arquivo"
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled}
          className="min-h-[40px] max-h-[160px] resize-none"
          rows={1}
        />
        {isStreaming ? (
          <Button variant="destructive" size="icon" className="shrink-0" onClick={onStop} aria-label="Parar" title="Parar">
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="shrink-0"
            disabled={!canSend}
            onClick={handleSend}
            aria-label="Enviar"
            title="Enviar"
          >
            <SendHorizontal className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
