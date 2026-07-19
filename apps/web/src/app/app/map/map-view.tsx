"use client";

import { useEffect, useRef } from "react";
import type { Map as MaplibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export interface MapPointData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * MapLibre map of property points. It renders a visual map only when a tile
 * style URL is configured (`MAP_STYLE_URL`); otherwise nothing is drawn and the
 * accessible list rendered by the server is the primary view. MapLibre is
 * imported lazily inside an effect so it never runs during SSR.
 */
export function MapView({
  points,
  styleUrl,
}: {
  points: MapPointData[];
  styleUrl: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!styleUrl || !containerRef.current) return;
    let map: MaplibreMap | undefined;
    let cancelled = false;

    void import("maplibre-gl").then(({ default: maplibregl }) => {
      if (cancelled || !containerRef.current) return;
      map = new maplibregl.Map({
        container: containerRef.current,
        style: styleUrl,
        center: [115.1, -8.65],
        zoom: 9,
      });
      for (const point of points) {
        new maplibregl.Marker()
          .setLngLat([point.longitude, point.latitude])
          .setPopup(new maplibregl.Popup().setText(point.name))
          .addTo(map);
      }
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points, styleUrl]);

  if (!styleUrl) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Map of property locations"
      className="h-[420px] w-full overflow-hidden rounded-lg border border-border"
    />
  );
}
