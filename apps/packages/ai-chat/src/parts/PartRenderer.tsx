import { memo, useState } from "react";
import { Paperclip, FileText, ChevronDown } from "lucide-react";
import { Markdown } from "../components/Markdown.js";
import { LazyRender } from "../components/LazyRender.js";
import { ReasoningBlock } from "./ReasoningBlock.js";
import { ToolActivity } from "./ToolActivity.js";
import { ToolResult } from "./ToolResult.js";
import { resolveDisplayRenderer } from "../display/registry.js";
import type { DisplayRendererMap } from "../display/registry.js";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "../ui/collapsible.js";
import { cn } from "../lib/utils.js";

const HEAVY_RENDERERS = new Set([
  "chart", "map", "table",
  "spreadsheet", "gallery", "image",
]);

// Minimal part types — mirrors @ai-sdk/react Message["parts"]
type TextPart = { type: "text"; text: string };
type ReasoningPart = { type: "reasoning"; reasoning: string };
type ToolInvocationPart = {
  type: "tool-invocation";
  toolInvocation: {
    toolName: string;
    toolCallId?: string;
    state: "call" | "partial-call" | "result";
    args?: Record<string, unknown>;
    result?: unknown;
  };
};
type ImageAttachmentPart = { type: "image"; _ref?: string; mimeType?: string };
type FileAttachmentPart = { type: "file"; _ref?: string; mimeType?: string };
type MessagePart = TextPart | ReasoningPart | ToolInvocationPart | ImageAttachmentPart | FileAttachmentPart | { type: string };

export interface PartRendererProps {
  part: MessagePart;
  isStreaming?: boolean;
  displayRenderers?: DisplayRendererMap;
  attachmentUrl?: (ref: string) => string;
}

// ─── Attachment sub-components ────────────────────────────────────────────────

function AttachmentImage({ src }: { src: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <img
        src={src}
        loading="lazy"
        alt="Imagem anexada"
        className="max-w-xs rounded-lg border cursor-pointer object-cover"
        onClick={() => setOpen(true)}
      />
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setOpen(false)}
        >
          <img
            src={src}
            alt="Imagem em tamanho real"
            className="max-w-[90vw] max-h-[90vh] rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

function AudioAttachment({ src }: { src: string }) {
  return (
    <audio controls src={src} className="max-w-xs w-full" />
  );
}

function PdfChip({ src, filename }: { src: string; filename: string }) {
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border bg-muted px-3 py-2 text-sm hover:bg-muted/80 transition-colors"
    >
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="max-w-[200px] truncate">{filename}</span>
    </a>
  );
}

function AttachmentTextBlock({ filename, content }: { filename: string; content: string }) {
  const [open, setOpen] = useState(false);
  const lines = content.split("\n");
  const preview = lines.slice(0, 3).join("\n") + (lines.length > 3 && !open ? "\n…" : "");

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border text-xs overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
        <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate font-medium">{filename}</span>
        <CollapsibleTrigger asChild>
          <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" aria-label={open ? "Recolher" : "Expandir"}>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
      </div>
      <pre className="px-3 py-2 text-muted-foreground whitespace-pre-wrap break-words">{preview}</pre>
      <CollapsibleContent>
        <pre className="px-3 py-2 max-h-40 overflow-auto whitespace-pre-wrap break-words border-t">{content}</pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Main renderer ────────────────────────────────────────────────────────────

export const PartRenderer = memo(function PartRenderer({ part, isStreaming, displayRenderers, attachmentUrl }: PartRendererProps) {
  switch (part.type) {
    case "text": {
      const p = part as TextPart;
      // Pre-processed attachment text: "[📎 filename]\ncontent"
      if (p.text.startsWith("[📎")) {
        const firstNewline = p.text.indexOf("\n");
        const header = firstNewline >= 0 ? p.text.slice(0, firstNewline) : p.text;
        const body = firstNewline >= 0 ? p.text.slice(firstNewline + 1) : "";
        const match = header.match(/^\[📎\s+(.+?)\]?$/);
        const filename = match?.[1] ?? header;
        return <AttachmentTextBlock filename={filename} content={body} />;
      }
      return <Markdown>{p.text}</Markdown>;
    }

    case "reasoning": {
      const p = part as ReasoningPart;
      return <ReasoningBlock content={p.reasoning} isStreaming={isStreaming} />;
    }

    case "tool-invocation": {
      const { toolInvocation } = part as ToolInvocationPart;
      const isDisplay = toolInvocation.toolName.startsWith("display_");

      if (isDisplay && toolInvocation.state === "result") {
        const result = toolInvocation.result as Record<string, unknown>;
        const action = typeof result?.action === "string" ? result.action : undefined;
        const Renderer = action ? resolveDisplayRenderer(action, displayRenderers) : null;
        if (Renderer) {
          const rendered = <Renderer {...result} />;
          if (!isStreaming && action && HEAVY_RENDERERS.has(action)) {
            return <LazyRender>{rendered}</LazyRender>;
          }
          return rendered;
        }
      }

      if (toolInvocation.state === "result") {
        return (
          <ToolResult
            toolName={toolInvocation.toolName}
            result={toolInvocation.result}
          />
        );
      }

      return (
        <ToolActivity
          toolName={toolInvocation.toolName}
          state={toolInvocation.state}
          args={toolInvocation.args}
        />
      );
    }

    case "image": {
      const p = part as ImageAttachmentPart;
      if (!p._ref || !attachmentUrl) return null;
      return <AttachmentImage src={attachmentUrl(p._ref)} />;
    }

    case "file": {
      const p = part as FileAttachmentPart;
      if (!p._ref || !attachmentUrl) return null;
      const src = attachmentUrl(p._ref);
      if (p.mimeType?.startsWith("audio/")) {
        return <AudioAttachment src={src} />;
      }
      if (p.mimeType === "application/pdf") {
        // Extract a human-readable filename from the att_ts_hex.ext pattern
        const filename = p._ref.replace(/^att_\d+_[0-9a-f]+\./, "") || p._ref;
        return <PdfChip src={src} filename={filename} />;
      }
      return null;
    }

    default:
      return null;
  }
});
