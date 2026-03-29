import { AlertCircle, CheckCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible.js";
import { cn } from "../lib/utils.js";

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
    <Collapsible open={expanded} onOpenChange={setExpanded} className={className}>
      <div className="rounded-md border border-border bg-muted/50 text-sm overflow-hidden">
        <CollapsibleTrigger
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2 text-left font-medium hover:bg-muted cursor-pointer",
            isError ? "text-destructive" : "text-foreground"
          )}
          aria-expanded={expanded}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="font-mono flex-1 truncate">{toolName}</span>
          <Chevron className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="max-h-80 overflow-y-auto p-3 font-mono text-xs whitespace-pre-wrap break-all bg-muted border-t border-border">
            {serialized}
          </pre>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
