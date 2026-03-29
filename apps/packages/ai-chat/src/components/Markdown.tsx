import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";
import type { ReactNode } from "react";

const components: Components = {
  a({ href, children, ...props }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
  table({ children }: { children?: ReactNode }) {
    return (
      <div style={{ overflowX: "auto" }}>
        <table>{children}</table>
      </div>
    );
  },
  pre({ children }: { children?: ReactNode }) {
    return <pre className="ai-chat-code-block">{children}</pre>;
  },
  code({ className, children, ...props }: { className?: string; children?: ReactNode; [key: string]: unknown }) {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="ai-chat-inline-code" {...props}>
        {children}
      </code>
    );
  },
};

interface MarkdownProps {
  children: string;
}

export function Markdown({ children }: MarkdownProps) {
  return (
    <div className="ai-chat-markdown">
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
