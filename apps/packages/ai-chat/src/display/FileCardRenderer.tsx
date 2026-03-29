import type { DisplayFile } from "@agentic-backbone/ai-sdk";
import {
  Download,
  File,
  FileCode,
  FileImage,
  FileMinus,
  FileText,
  FileVideo,
  Music,
} from "lucide-react";
import { Button } from "../ui/button.js";
import { Card } from "../ui/card.js";

function getFileIcon(type: string) {
  const mime = type.toLowerCase();
  if (mime.startsWith("image/")) return FileImage;
  if (mime.startsWith("video/")) return FileVideo;
  if (mime.startsWith("audio/")) return Music;
  if (mime === "application/pdf" || mime === "text/plain" || mime.includes("document")) return FileText;
  if (mime.includes("spreadsheet") || mime.includes("csv")) return FileMinus;
  if (mime.includes("javascript") || mime.includes("typescript") || mime.includes("json") || mime.includes("html") || mime.includes("css") || mime.includes("xml")) return FileCode;
  return File;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileCardRenderer({ name, type, size, url }: DisplayFile) {
  const Icon = getFileIcon(type);

  return (
    <Card className="flex items-center gap-3 p-3">
      <div className="shrink-0 text-primary">
        <Icon className="h-8 w-8" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{name}</p>
        <p className="text-xs text-muted-foreground">
          {type}{size !== undefined && ` · ${formatSize(size)}`}
        </p>
      </div>
      {url && (
        <Button variant="ghost" size="icon" asChild>
          <a href={url} download={name} aria-label={`Baixar ${name}`}>
            <Download className="h-4 w-4" />
          </a>
        </Button>
      )}
    </Card>
  );
}
