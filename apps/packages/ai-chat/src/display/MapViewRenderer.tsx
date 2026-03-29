import type { DisplayMap } from "@agentic-backbone/ai-sdk";
import { MapPin } from "lucide-react";
import { Card } from "../ui/card.js";
import { Separator } from "../ui/separator.js";

function buildOsmUrl(pins: DisplayMap["pins"], zoom: number): string {
  if (pins.length === 0) {
    return `https://www.openstreetmap.org/export/embed.html?bbox=-180,-90,180,90&layer=mapnik`;
  }

  const lat = pins.reduce((acc, p) => acc + p.lat, 0) / pins.length;
  const lng = pins.reduce((acc, p) => acc + p.lng, 0) / pins.length;

  const firstPin = pins[0]!;
  const markerParam =
    pins.length === 1
      ? `&mlat=${firstPin.lat}&mlon=${firstPin.lng}`
      : "";

  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.05},${lat - 0.05},${lng + 0.05},${lat + 0.05}&layer=mapnik&zoom=${zoom}${markerParam}`;
}

export function MapViewRenderer({ title, pins, zoom }: DisplayMap) {
  const osmUrl = buildOsmUrl(pins, zoom);

  return (
    <Card className="overflow-hidden">
      {title && (
        <div className="px-4 py-3">
          <h3 className="font-medium text-sm text-foreground">{title}</h3>
        </div>
      )}

      <div className="relative aspect-video bg-muted text-muted-foreground overflow-hidden">
        <iframe
          src={osmUrl}
          className="w-full h-full border-0"
          title={title ?? "Mapa OpenStreetMap"}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin"
        />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-10">
          <MapPin className="h-10 w-10" />
        </div>
      </div>

      {pins.length > 0 && (
        <>
          <Separator />
          <ul className="p-3 space-y-2" aria-label="Locais no mapa">
            {pins.map((pin, i) => (
              <li key={i} className="flex items-start gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-primary mt-0.5" aria-hidden="true" />
                <span className="flex flex-col min-w-0">
                  {pin.label && (
                    <span className="font-medium text-sm text-foreground">{pin.label}</span>
                  )}
                  {pin.address && (
                    <span className="text-xs text-muted-foreground">{pin.address}</span>
                  )}
                  {!pin.label && !pin.address && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
