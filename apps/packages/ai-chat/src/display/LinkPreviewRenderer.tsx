import { useState } from "react";
import type { DisplayLink } from "@agentic-backbone/ai-sdk";
import { Globe } from "lucide-react";
import { Card } from "../ui/card";

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
      aria-label={`Link: ${title}`}
    >
      <Card className="overflow-hidden hover:bg-muted/50 transition-colors">
        {image && !imgError && (
          <div className="aspect-video overflow-hidden">
            <img
              src={image}
              alt={title}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          </div>
        )}

        <div className="p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {favicon && !faviconError ? (
              <img
                src={favicon}
                alt=""
                className="w-3 h-3 rounded-sm"
                onError={() => setFaviconError(true)}
                aria-hidden="true"
              />
            ) : (
              <Globe size={12} aria-hidden="true" className="shrink-0" />
            )}
            <span>{displayDomain}</span>
          </div>

          <p className="font-medium text-foreground text-sm">{title}</p>

          {description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
          )}
        </div>
      </Card>
    </a>
  );
}
