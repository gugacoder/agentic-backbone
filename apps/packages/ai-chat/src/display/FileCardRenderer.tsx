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
    <div className="ai-chat-display ai-chat-display-file">
      <span className="ai-chat-display-file-icon" aria-hidden="true">
        <Icon size={24} />
      </span>
      <div className="ai-chat-display-file-info">
        <p className="ai-chat-display-file-name">{name}</p>
        <p className="ai-chat-display-file-meta">
          <span>{type}</span>
          {size !== undefined && <span>{formatSize(size)}</span>}
        </p>
      </div>
      {url && (
        <a
          href={url}
          download={name}
          className="ai-chat-display-file-download"
          aria-label={`Baixar ${name}`}
        >
          <Download size={16} />
        </a>
      )}
    </div>
  );
}
