import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { MarkdownDataTable } from "./MarkdownDataTable.js";
import { CodeBlock } from "./CodeBlock.js";

interface MarkdownRendererProps {
  content: string;
}

const components: Partial<Components> = {
  table: MarkdownDataTable as Components["table"],
  pre: CodeBlock as Components["pre"],
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_p]:leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
