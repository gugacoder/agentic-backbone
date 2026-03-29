import { useRef, useEffect } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../lib/utils";

export interface MessageInputProps {
  input: string;
  setInput: (value: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isLoading?: boolean;
  stop?: () => void;
  placeholder?: string;
  className?: string;
}

const LINE_HEIGHT_PX = 24;
const MIN_ROWS = 1;
const MAX_ROWS = 6;

export function MessageInput({
  input,
  setInput,
  handleSubmit,
  isLoading,
  stop,
  placeholder = "Digite uma mensagem...",
  className,
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-expand
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const scrollH = el.scrollHeight;
    const minH = MIN_ROWS * LINE_HEIGHT_PX;
    const maxH = MAX_ROWS * LINE_HEIGHT_PX;
    el.style.height = `${Math.min(Math.max(scrollH, minH), maxH)}px`;
  }, [input]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim()) {
        handleSubmit(e as unknown as React.FormEvent);
      }
    }
  }

  return (
    <div className={cn("flex items-end gap-3 rounded-xl border border-input bg-background p-2", className)}>
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={MIN_ROWS}
        style={{ minHeight: `${MIN_ROWS * LINE_HEIGHT_PX}px`, maxHeight: `${MAX_ROWS * LINE_HEIGHT_PX}px` }}
        disabled={isLoading}
        aria-label="Mensagem"
        className="flex-1 bg-transparent border-none text-foreground text-sm resize-none outline-none placeholder:text-muted-foreground"
      />
      {isLoading && stop ? (
        <Button
          type="button"
          size="icon"
          variant="destructive"
          onClick={stop}
          aria-label="Parar geração"
        >
          <Square className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          type="submit"
          size="icon"
          onClick={(e) => handleSubmit(e)}
          disabled={!input.trim() || !!isLoading}
          aria-label="Enviar mensagem"
        >
          <Send className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
