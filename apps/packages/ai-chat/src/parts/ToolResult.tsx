import { AlertCircle, CheckCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

export interface ToolResultProps {
  toolName: string;
  result: unknown;
  isError?: boolean;
  className?: string;
}

function serializeResult(result: unknown): string {
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

export function ToolResult({ toolName, result, isError = false, className }: ToolResultProps) {
  const [expanded, setExpanded] = useState(false);
  const serialized = serializeResult(result);
  const Icon = isError ? AlertCircle : CheckCircle;
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <div className={`ai-chat-tool-result${isError ? " ai-chat-tool-result--error" : " ai-chat-tool-result--success"}${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className="ai-chat-tool-result-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="ai-chat-tool-result-icon" aria-hidden="true">
          <Icon size={14} />
        </span>
        <span className="ai-chat-tool-result-name">{toolName}</span>
        <span className="ai-chat-tool-result-chevron" aria-hidden="true">
          <Chevron size={14} />
        </span>
      </button>
      {expanded && (
        <div className="ai-chat-tool-result-body">
          <pre className="ai-chat-code-block ai-chat-tool-result-pre">{serialized}</pre>
        </div>
      )}
    </div>
  );
}
