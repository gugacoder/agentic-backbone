import { useEffect, useState } from "react";
import { Brain, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible.js";

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

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded} className={className}>
      <div className="bg-muted/50 border border-border rounded-md text-sm overflow-hidden">
        <CollapsibleTrigger className="flex items-center gap-2 px-3 py-2 w-full text-left font-medium text-muted-foreground hover:bg-muted cursor-pointer">
          <Brain className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Raciocinio</span>
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5 ml-auto" aria-hidden="true" />
            : <ChevronRight className="h-3.5 w-3.5 ml-auto" aria-hidden="true" />
          }
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="max-h-96 overflow-y-auto px-3 py-3 text-muted-foreground whitespace-pre-wrap break-words border-t border-border">
            {content}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
