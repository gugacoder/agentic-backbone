import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";
import { cn } from "../lib/utils.js";

const components: Components = {
  pre({ children }) {
    return (
      <pre className="bg-muted border border-border rounded-md my-3 overflow-hidden">
        {children}
      </pre>
    );
  },
  code({ className, children }) {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code className={cn("block p-4 overflow-x-auto font-mono text-sm", className)}>
          {children}
        </code>
      );
    }
    return (
      <code className="bg-muted border border-border rounded-sm px-1.5 py-0.5 font-mono text-sm">
        {children}
      </code>
    );
  },
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">
        {children}
      </a>
    );
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-[3px] border-border my-3 py-1 px-3 text-muted-foreground">
        {children}
      </blockquote>
    );
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border border-border px-3 py-1.5 text-left font-semibold bg-muted">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="border border-border px-3 py-1.5 text-left">
        {children}
      </td>
    );
  },
};

interface MarkdownProps {
  children: string;
}

export function Markdown({ children }: MarkdownProps) {
  return (
    <div className="text-foreground text-sm leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0 [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_h1,&_h2,&_h3,&_h4]:font-semibold [&_h1,&_h2,&_h3,&_h4]:mt-5 [&_h1,&_h2,&_h3,&_h4]:mb-2 [&_ul,&_ol]:pl-6 [&_ul,&_ol]:my-2 [&_li]:my-1 [&_hr]:border-border [&_hr]:my-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
