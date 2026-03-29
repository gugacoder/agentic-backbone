import type { DisplayCode } from "@agentic-backbone/ai-sdk";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button.js";
import { cn } from "../lib/utils.js";

export function CodeBlockRenderer({ language, code, title, lineNumbers }: DisplayCode) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const displayLines = lineNumbers
    ? code.split("\n").map((line, i) => (
        <span key={i} className="flex gap-4">
          <span className="select-none text-muted-foreground w-6 text-right shrink-0">{i + 1}</span>
          <span>{line}</span>
        </span>
      ))
    : code;

  return (
    <div className={cn("rounded-md border border-border bg-muted overflow-hidden")}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <span className="text-xs text-muted-foreground font-mono">{title ?? language}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          aria-label={copied ? "Copiado!" : "Copiar código"}
          className="h-7 gap-1.5"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          <span className="text-xs">{copied ? "Copiado!" : "Copiar"}</span>
        </Button>
      </div>
      <pre className="p-4 overflow-x-auto font-mono text-sm">
        {lineNumbers ? (
          <code>{displayLines}</code>
        ) : (
          <code>{code}</code>
        )}
      </pre>
    </div>
  );
}
