import { useState } from "react";
import type { DisplayGallery } from "@agentic-backbone/ai-sdk";
import { ZoomIn } from "lucide-react";
import { cn } from "../lib/utils.js";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog.js";

export function GalleryRenderer({ title, images }: DisplayGallery) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const activeImage = lightboxIdx !== null ? images[lightboxIdx] : null;

  return (
    <div className="space-y-2">
      {title && <h3 className="text-sm font-medium text-foreground">{title}</h3>}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {images.map((img, i) => (
          <button
            key={i}
            className="relative group cursor-pointer rounded-md overflow-hidden"
            onClick={() => setLightboxIdx(i)}
            aria-label={img.alt ?? `Imagem ${i + 1}`}
          >
            <img
              src={img.url}
              alt={img.alt ?? ""}
              className="w-full h-full object-cover aspect-square"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-background/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <ZoomIn className="h-5 w-5 text-foreground" />
            </div>
            {img.caption && (
              <p className="absolute bottom-0 left-0 right-0 text-sm text-muted-foreground bg-background/80 px-2 py-1 truncate">
                {img.caption}
              </p>
            )}
          </button>
        ))}
      </div>

      <Dialog open={lightboxIdx !== null} onOpenChange={(open) => { if (!open) setLightboxIdx(null); }}>
        <DialogContent className={cn("max-w-4xl p-0 bg-background/95")}>
          <DialogTitle className="sr-only">
            {activeImage?.alt ?? "Visualizador de imagem"}
          </DialogTitle>
          {activeImage && (
            <div className="flex flex-col">
              <img
                src={activeImage.url}
                alt={activeImage.alt ?? ""}
                className="w-full max-h-[80vh] object-contain"
              />
              {activeImage.caption && (
                <p className="text-sm text-muted-foreground px-4 py-3">
                  {activeImage.caption}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
