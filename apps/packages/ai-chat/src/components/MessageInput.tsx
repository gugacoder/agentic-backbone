import { useRef, useEffect } from "react";
import { Send, Square } from "lucide-react";

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
    <div className={["ai-chat-input", className].filter(Boolean).join(" ")}>
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
      />
      {isLoading && stop ? (
        <button
          type="button"
          className="ai-chat-input-btn ai-chat-input-btn-abort"
          onClick={stop}
          aria-label="Parar geração"
        >
          <Square size={18} />
        </button>
      ) : (
        <button
          type="submit"
          className="ai-chat-input-btn ai-chat-input-btn-send"
          onClick={(e) => handleSubmit(e)}
          disabled={!input.trim() || !!isLoading}
          aria-label="Enviar mensagem"
        >
          <Send size={18} />
        </button>
      )}
    </div>
  );
}
