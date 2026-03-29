import { useState, useRef, useEffect } from "react";
import type { DisplayGallery } from "@agentic-backbone/ai-sdk";
import { X, ZoomIn } from "lucide-react";

export function GalleryRenderer({ title, images, layout, columns }: DisplayGallery) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (lightboxIdx !== null) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [lightboxIdx]);

  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      setLightboxIdx(null);
    }
  }

  const activeImage = lightboxIdx !== null ? images[lightboxIdx] : null;

  return (
    <div className="ai-chat-display ai-chat-display-gallery">
      {title && <h3 className="ai-chat-display-gallery-title">{title}</h3>}

      <div
        className={`ai-chat-display-gallery-grid ai-chat-display-gallery-grid--${layout}`}
        style={{ "--gallery-columns": columns } as React.CSSProperties}
      >
        {images.map((img, i) => (
          <button
            key={i}
            className="ai-chat-display-gallery-item"
            onClick={() => setLightboxIdx(i)}
            aria-label={img.alt ?? `Imagem ${i + 1}`}
          >
            <img
              src={img.url}
              alt={img.alt ?? ""}
              className="ai-chat-display-gallery-img"
              loading="lazy"
            />
            <span className="ai-chat-display-gallery-zoom-hint" aria-hidden="true">
              <ZoomIn size={16} />
            </span>
            {img.caption && (
              <span className="ai-chat-display-gallery-caption">{img.caption}</span>
            )}
          </button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        className="ai-chat-display-gallery-dialog"
        onClick={handleDialogClick}
        onClose={() => setLightboxIdx(null)}
        aria-label={activeImage?.alt ?? "Visualizador de imagem"}
      >
        {activeImage && (
          <div className="ai-chat-display-gallery-dialog-inner">
            <button
              className="ai-chat-display-gallery-dialog-close"
              onClick={() => setLightboxIdx(null)}
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
            <img
              src={activeImage.url}
              alt={activeImage.alt ?? ""}
              className="ai-chat-display-gallery-dialog-img"
            />
            {activeImage.caption && (
              <p className="ai-chat-display-gallery-dialog-caption">{activeImage.caption}</p>
            )}
          </div>
        )}
      </dialog>
    </div>
  );
}
