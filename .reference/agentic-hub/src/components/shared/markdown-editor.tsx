import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
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
          className="rounded-md border bg-muted/30 p-5 overflow-auto"
          style={{ minHeight }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
            components={mdComponents}
          >
            {value || "*Sem conteúdo*"}
          </ReactMarkdown>
        </div>
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

const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold mb-4 mt-0 border-b pb-2 border-border">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold mb-3 mt-6 border-b pb-1 border-border/50">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold mb-2 mt-4">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-semibold mb-2 mt-3">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="mb-3 text-sm leading-relaxed last:mb-0">{children}</p>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-primary underline underline-offset-4 hover:opacity-80" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-muted-foreground">{children}</em>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code className="block w-full rounded bg-muted px-3 py-2 font-mono text-xs leading-relaxed text-foreground overflow-x-auto whitespace-pre">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-3 rounded-md border border-border overflow-hidden">{children}</pre>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 ml-4 space-y-1 list-disc text-sm">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 ml-4 space-y-1 list-decimal text-sm">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-4 border-border pl-4 italic text-muted-foreground text-sm">
      {children}
    </blockquote>
  ),
  hr: () => (
    <hr className="my-4 border-border" />
  ),
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/50">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border border-border px-3 py-2 text-left font-semibold text-xs uppercase tracking-wide">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-3 py-2 text-sm">{children}</td>
  ),
  tr: ({ children }) => (
    <tr className="even:bg-muted/20">{children}</tr>
  ),
};
