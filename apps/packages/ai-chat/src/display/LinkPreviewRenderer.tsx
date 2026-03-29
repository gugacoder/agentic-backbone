import { useState } from "react";
import type { DisplayLink } from "@agentic-backbone/ai-sdk";
import { Globe, ExternalLink } from "lucide-react";

function getDomain(url: string, domainProp?: string): string {
  if (domainProp) return domainProp;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function LinkPreviewRenderer({
  url,
  title,
  description,
  image,
  favicon,
  domain,
}: DisplayLink) {
  const [imgError, setImgError] = useState(false);
  const [faviconError, setFaviconError] = useState(false);

  const displayDomain = getDomain(url, domain);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="ai-chat-display ai-chat-display-link"
      aria-label={`Link: ${title}`}
    >
      {image && !imgError && (
        <div className="ai-chat-display-link-image-wrap">
          <img
            src={image}
            alt={title}
            className="ai-chat-display-link-image"
            onError={() => setImgError(true)}
          />
        </div>
      )}

      <div className="ai-chat-display-link-body">
        <div className="ai-chat-display-link-domain">
          {favicon && !faviconError ? (
            <img
              src={favicon}
              alt=""
              className="ai-chat-display-link-favicon"
              onError={() => setFaviconError(true)}
              aria-hidden="true"
            />
          ) : (
            <Globe size={12} className="ai-chat-display-link-favicon-fallback" aria-hidden="true" />
          )}
          <span>{displayDomain}</span>
        </div>

        <h3 className="ai-chat-display-link-title">{title}</h3>

        {description && (
          <p className="ai-chat-display-link-description">{description}</p>
        )}

        <span className="ai-chat-display-link-cta" aria-hidden="true">
          <ExternalLink size={12} />
          Abrir link
        </span>
      </div>
    </a>
  );
}
