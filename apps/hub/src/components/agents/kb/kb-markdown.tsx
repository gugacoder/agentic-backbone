import { useMemo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  extractWikiTarget,
  preprocessWikilinks,
  resolveWikilink,
} from "./utils";

interface KbMarkdownProps {
  content: string;
  allPaths: string[];
  onNavigate: (path: string) => void;
}

export function KbMarkdown({ content, allPaths, onNavigate }: KbMarkdownProps) {
  const preprocessed = useMemo(() => preprocessWikilinks(content), [content]);

  return (
    <TooltipProvider delay={200}>
      <div
        className={cn(
          "prose prose-sm dark:prose-invert max-w-none",
          "prose-headings:font-semibold prose-headings:tracking-tight",
          "prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg",
          "prose-p:leading-relaxed",
          "prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5",
          "prose-code:font-mono prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none",
          "prose-pre:bg-muted prose-pre:text-foreground prose-pre:rounded-md prose-pre:border",
          "prose-pre:[&>code]:bg-transparent prose-pre:[&>code]:p-0",
          "prose-blockquote:border-l-4 prose-blockquote:border-muted-foreground/30",
          "prose-blockquote:pl-4 prose-blockquote:text-muted-foreground",
          "prose-table:text-xs prose-th:border prose-td:border prose-th:px-2 prose-th:py-1",
          "prose-td:px-2 prose-td:py-1 prose-th:bg-muted",
          "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
          "prose-hr:border-border",
        )}
      >
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children, ...rest }) => {
              const wikiTarget = href ? extractWikiTarget(href) : null;
              if (wikiTarget) {
                const resolved = resolveWikilink(wikiTarget, allPaths);
                if (resolved) {
                  return (
                    <a
                      href={`#/${resolved}`}
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigate(resolved);
                      }}
                      className="text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid"
                      title={resolved}
                    >
                      {children}
                    </a>
                  );
                }
                return (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="text-muted-foreground line-through decoration-dotted cursor-help" />
                      }
                    >
                      {children}
                    </TooltipTrigger>
                    <TooltipContent>
                      Wikilink não resolvido: {wikiTarget}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  {...rest}
                >
                  {children}
                </a>
              );
            },
          }}
        >
          {preprocessed}
        </Markdown>
      </div>
    </TooltipProvider>
  );
}
