import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";
import { cn } from "../lib/utils.js";

const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS = [rehypeHighlight];

const components: Components = {
  h1({ children }) {
    return <h1 className="text-xl font-semibold" style={{ marginTop: "20px", marginBottom: "8px" }}>{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-lg font-semibold" style={{ marginTop: "20px", marginBottom: "8px" }}>{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-base font-semibold" style={{ marginTop: "20px", marginBottom: "8px" }}>{children}</h3>;
  },
  h4({ children }) {
    return <h4 className="font-semibold" style={{ marginTop: "20px", marginBottom: "8px" }}>{children}</h4>;
  },
  p({ children }) {
    return <p style={{ marginBottom: "16px" }}>{children}</p>;
  },
  ul({ children }) {
    return <ul style={{ paddingLeft: "24px", marginTop: "8px", marginBottom: "8px", listStyleType: "disc" }}>{children}</ul>;
  },
  ol({ children }) {
    return <ol style={{ paddingLeft: "24px", marginTop: "8px", marginBottom: "8px", listStyleType: "decimal" }}>{children}</ol>;
  },
  li({ children }) {
    return <li style={{ marginTop: "4px", marginBottom: "4px" }}>{children}</li>;
  },
  hr() {
    return <hr className="border-border" style={{ marginTop: "16px", marginBottom: "16px" }} />;
  },
  pre({ children }) {
    return (
      <pre className="bg-muted border border-border rounded-md overflow-hidden" style={{ marginTop: "12px", marginBottom: "12px" }}>
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
      <blockquote className="border-l-[3px] border-border py-1 px-3 text-muted-foreground" style={{ marginTop: "12px", marginBottom: "12px" }}>
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

export const Markdown = memo(function Markdown({ children }: MarkdownProps) {
  return (
    <div className="text-foreground text-sm" style={{ lineHeight: "1.625em" }}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});
