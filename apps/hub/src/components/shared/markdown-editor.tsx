import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Eye, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = "200px",
}: MarkdownEditorProps) {
  const [preview, setPreview] = useState(false);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-end gap-1">
        <Button
          variant={preview ? "ghost" : "secondary"}
          size="sm"
          onClick={() => setPreview(false)}
        >
          <Pencil className="h-3.5 w-3.5 mr-1" />
          Edit
        </Button>
        <Button
          variant={preview ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setPreview(true)}
        >
          <Eye className="h-3.5 w-3.5 mr-1" />
          Preview
        </Button>
      </div>
      {preview ? (
        <div
          className="prose prose-sm dark:prose-invert max-w-none rounded-md border bg-muted/50 p-4 overflow-auto"
          style={{ minHeight }}
          dangerouslySetInnerHTML={{ __html: simpleMarkdown(value) }}
        />
      ) : (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="font-mono text-sm"
          style={{ minHeight }}
        />
      )}
    </div>
  );
}

function simpleMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/\n/g, "<br />");
}
