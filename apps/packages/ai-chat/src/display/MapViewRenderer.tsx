import type { DisplayMap } from "@agentic-backbone/ai-sdk";
import { MapPin } from "lucide-react";

function buildOsmUrl(pins: DisplayMap["pins"], zoom: number): string {
  if (pins.length === 0) {
    return `https://www.openstreetmap.org/export/embed.html?bbox=-180,-90,180,90&layer=mapnik`;
  }

  // Center on first pin or average of all
  const lat =
    pins.reduce((acc, p) => acc + p.lat, 0) / pins.length;
  const lng =
    pins.reduce((acc, p) => acc + p.lng, 0) / pins.length;

  // Build marker params: OSM embed supports a single marker via mlat/mlon
  // For multiple pins, we center + list them below the map
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
    <div className="ai-chat-display ai-chat-display-map">
      {title && <h3 className="ai-chat-display-map-title">{title}</h3>}

      <div className="ai-chat-display-map-frame-wrap">
        <iframe
          src={osmUrl}
          className="ai-chat-display-map-frame"
          title={title ?? "Mapa OpenStreetMap"}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>

      {pins.length > 0 && (
        <ul className="ai-chat-display-map-pins-list" aria-label="Locais no mapa">
          {pins.map((pin, i) => (
            <li key={i} className="ai-chat-display-map-pin">
              <span className="ai-chat-display-map-pin-icon" aria-hidden="true">
                <MapPin size={14} />
              </span>
              <span className="ai-chat-display-map-pin-info">
                {pin.label && (
                  <span className="ai-chat-display-map-pin-label">{pin.label}</span>
                )}
                {pin.address && (
                  <span className="ai-chat-display-map-pin-address">{pin.address}</span>
                )}
                {!pin.label && !pin.address && (
                  <span className="ai-chat-display-map-pin-coords">
                    {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
