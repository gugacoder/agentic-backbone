import { useState, useRef, useEffect } from "react";
import type { DisplayImage } from "@agentic-backbone/ai-sdk";
import { ZoomIn, ZoomOut, X } from "lucide-react";

export function ImageViewerRenderer({ url, alt, caption, width, height }: DisplayImage) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (dialogOpen) {
      setZoom(1);
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [dialogOpen]);

  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      setDialogOpen(false);
    }
  }

  return (
    <div className="ai-chat-display ai-chat-display-image">
      <button
        className="ai-chat-display-image-trigger"
        onClick={() => setDialogOpen(true)}
        aria-label={`Ampliar imagem${alt ? `: ${alt}` : ""}`}
      >
        <img
          src={url}
          alt={alt ?? ""}
          className="ai-chat-display-image-thumb"
          width={width}
          height={height}
        />
        <span className="ai-chat-display-image-zoom-hint" aria-hidden="true">
          <ZoomIn size={16} />
        </span>
      </button>

      {caption && <p className="ai-chat-display-image-caption">{caption}</p>}

      <dialog
        ref={dialogRef}
        className="ai-chat-display-image-dialog"
        onClick={handleDialogClick}
        onClose={() => setDialogOpen(false)}
        aria-label={alt ?? "Visualizador de imagem"}
      >
        <div className="ai-chat-display-image-dialog-inner">
          <div className="ai-chat-display-image-dialog-toolbar">
            <button
              className="ai-chat-display-image-dialog-btn"
              onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
              aria-label="Reduzir zoom"
              disabled={zoom <= 0.25}
            >
              <ZoomOut size={18} />
            </button>
            <span className="ai-chat-display-image-dialog-zoom-label">
              {Math.round(zoom * 100)}%
            </span>
            <button
              className="ai-chat-display-image-dialog-btn"
              onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
              aria-label="Aumentar zoom"
              disabled={zoom >= 4}
            >
              <ZoomIn size={18} />
            </button>
            <button
              className="ai-chat-display-image-dialog-btn ai-chat-display-image-dialog-btn--close"
              onClick={() => setDialogOpen(false)}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          <div className="ai-chat-display-image-dialog-scroll">
            <img
              src={url}
              alt={alt ?? ""}
              className="ai-chat-display-image-dialog-img"
              style={{ transform: `scale(${zoom})` }}
              width={width}
              height={height}
            />
          </div>

          {caption && (
            <p className="ai-chat-display-image-dialog-caption">{caption}</p>
          )}
        </div>
      </dialog>
    </div>
  );
}
