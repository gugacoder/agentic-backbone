import { useState } from "react";
import type { DisplayImage } from "@agentic-backbone/ai-sdk";
import { ZoomIn, ZoomOut, RotateCcw, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog.js";
import { Button } from "../ui/button.js";
import { cn } from "../lib/utils.js";

export function ImageViewerRenderer({ url, alt, caption, width, height }: DisplayImage) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  function handleOpen() {
    setZoom(1);
    setDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        className="relative group cursor-pointer rounded-md overflow-hidden inline-block"
        onClick={handleOpen}
        aria-label={`Ampliar imagem${alt ? `: ${alt}` : ""}`}
      >
        <img
          src={url}
          alt={alt ?? ""}
          className="block max-w-full rounded-md"
          width={width}
          height={height}
        />
        <div className="absolute inset-0 bg-background/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <ZoomIn className="h-5 w-5 text-foreground" />
        </div>
      </button>

      {caption && (
        <p className="text-xs text-muted-foreground">{caption}</p>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl p-0 bg-background/95 overflow-hidden">
          <DialogTitle className="sr-only">{alt ?? "Visualizador de imagem"}</DialogTitle>

          <div className="flex flex-col">
            <div className="flex items-center gap-1 p-2 border-b border-border">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                aria-label="Reduzir zoom"
                disabled={zoom <= 0.25}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>

              <span className={cn("text-xs text-muted-foreground w-12 text-center tabular-nums")}>
                {Math.round(zoom * 100)}%
              </span>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                aria-label="Aumentar zoom"
                disabled={zoom >= 4}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoom(1)}
                aria-label="Resetar zoom"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>

              <div className="flex-1" />

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDialogOpen(false)}
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="overflow-auto max-h-[80vh] flex items-center justify-center p-4">
              <img
                src={url}
                alt={alt ?? ""}
                style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
                className="max-w-full transition-transform"
                width={width}
                height={height}
              />
            </div>

            {caption && (
              <p className="text-xs text-muted-foreground text-center p-2 border-t border-border">
                {caption}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
