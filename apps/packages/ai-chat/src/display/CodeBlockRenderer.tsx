import type { DisplayCode } from "@agentic-backbone/ai-sdk";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CodeBlockRenderer({ language, code, title, lineNumbers }: DisplayCode) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const displayLines = lineNumbers
    ? code.split("\n").map((line, i) => (
        <span key={i} className="ai-chat-display-code-line">
          <span className="ai-chat-display-code-lineno">{i + 1}</span>
          <span>{line}</span>
        </span>
      ))
    : code;

  return (
    <div className="ai-chat-display ai-chat-display-code">
      <div className="ai-chat-display-code-header">
        <span className="ai-chat-display-code-lang">{title ?? language}</span>
        <button
          type="button"
          className="ai-chat-display-code-copy"
          onClick={handleCopy}
          aria-label={copied ? "Copiado!" : "Copiar código"}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? "Copiado!" : "Copiar"}</span>
        </button>
      </div>
      <pre className="ai-chat-display-code-body">
        {lineNumbers ? (
          <code className="ai-chat-display-code-content">{displayLines}</code>
        ) : (
          <code className="ai-chat-display-code-content">{code}</code>
        )}
      </pre>
    </div>
  );
}
