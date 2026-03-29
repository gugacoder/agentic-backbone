import type { DisplaySources } from "@agentic-backbone/ai-sdk";
import { ExternalLink, Globe } from "lucide-react";

export function SourcesListRenderer({ label, sources }: DisplaySources) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <ol className="space-y-1">
        {sources.map((source, index) => (
          <li key={index}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 p-2 rounded-md hover:bg-muted text-sm"
            >
              <span className="text-xs text-muted-foreground font-mono w-5 shrink-0 pt-0.5">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {source.favicon ? (
                    <img
                      src={source.favicon}
                      alt=""
                      width={14}
                      height={14}
                      className="shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <Globe size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span className="font-medium text-primary truncate">{source.title}</span>
                  <ExternalLink size={12} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                </div>
                {source.snippet && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{source.snippet}</p>
                )}
              </div>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
