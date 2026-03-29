import { useEffect, useState } from "react";
import { Brain, ChevronDown, ChevronRight } from "lucide-react";

export interface ReasoningBlockProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

export function ReasoningBlock({ content, isStreaming = false, className }: ReasoningBlockProps) {
  const [expanded, setExpanded] = useState(isStreaming);

  useEffect(() => {
    if (isStreaming) {
      setExpanded(true);
    } else {
      setExpanded(false);
    }
  }, [isStreaming]);

  const handleToggle = () => {
    setExpanded((prev) => !prev);
  };

  return (
    <div className={`ai-chat-reasoning${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className="ai-chat-reasoning-header"
        onClick={handleToggle}
        aria-expanded={expanded}
      >
        <Brain size={14} aria-hidden="true" />
        <span>Raciocinio</span>
        {expanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
      </button>
      {expanded && (
        <div className="ai-chat-reasoning-body">
          {content}
        </div>
      )}
    </div>
  );
}
