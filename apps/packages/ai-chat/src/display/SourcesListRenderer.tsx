import type { DisplaySources } from "@agentic-backbone/ai-sdk";
import { ExternalLink, Globe } from "lucide-react";

export function SourcesListRenderer({ label, sources }: DisplaySources) {
  return (
    <div className="ai-chat-display ai-chat-display-sources">
      <p className="ai-chat-display-sources-label">{label}</p>
      <ol className="ai-chat-display-sources-list">
        {sources.map((source, index) => (
          <li key={index} className="ai-chat-display-sources-item">
            <span className="ai-chat-display-sources-index" aria-hidden="true">
              {index + 1}
            </span>
            <div className="ai-chat-display-sources-body">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ai-chat-display-sources-link"
              >
                {source.favicon ? (
                  <img
                    src={source.favicon}
                    alt=""
                    width={14}
                    height={14}
                    className="ai-chat-display-sources-favicon"
                    aria-hidden="true"
                  />
                ) : (
                  <Globe size={14} className="ai-chat-display-sources-favicon" aria-hidden="true" />
                )}
                <span className="ai-chat-display-sources-title">{source.title}</span>
                <ExternalLink size={12} aria-hidden="true" />
              </a>
              {source.snippet && (
                <p className="ai-chat-display-sources-snippet">{source.snippet}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
