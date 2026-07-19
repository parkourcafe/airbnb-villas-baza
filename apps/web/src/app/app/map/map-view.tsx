"use client";

import { useEffect, useRef } from "react";
import type { Map as MaplibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export interface MapPointData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  lifecycleStatus: string | null;
}

// Lifecycle colour ramp — observation language only, no "removed/banned".
const LIFECYCLE_COLORS: Record<string, string> = {
  active: "#16a34a",
  first_miss: "#eab308",
  suspected_inactive: "#f97316",
  confirmed_inactive: "#dc2626",
  reactivated: "#2563eb",
};
const DEFAULT_COLOR = "#6b7280";

/**
 * MapLibre map of property points with marker clustering and lifecycle-coloured
 * unclustered points. Renders only when a tile style URL is configured
 * (`MAP_STYLE_URL`); otherwise the server-rendered accessible list is the
 * primary view. MapLibre is imported lazily so it never runs during SSR.
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

    const geojson = {
      type: "FeatureCollection" as const,
      features: points.map((p) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [p.longitude, p.latitude],
        },
        properties: {
          name: p.name,
          color: LIFECYCLE_COLORS[p.lifecycleStatus ?? ""] ?? DEFAULT_COLOR,
        },
      })),
    };

    void import("maplibre-gl").then(({ default: maplibregl }) => {
      if (cancelled || !containerRef.current) return;
      map = new maplibregl.Map({
        container: containerRef.current,
        style: styleUrl,
        center: [115.1, -8.65],
        zoom: 9,
      });

      map.on("load", () => {
        if (!map) return;
        map.addSource("properties", {
          type: "geojson",
          data: geojson,
          cluster: true,
          clusterRadius: 50,
          clusterMaxZoom: 14,
        });

        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "properties",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#2563eb",
            "circle-opacity": 0.8,
            "circle-radius": [
              "step",
              ["get", "point_count"],
              14,
              10,
              20,
              50,
              28,
            ],
          },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "properties",
          filter: ["has", "point_count"],
          layout: {
            "text-field": "{point_count_abbreviated}",
            "text-size": 12,
          },
          paint: { "text-color": "#ffffff" },
        });
        map.addLayer({
          id: "unclustered",
          type: "circle",
          source: "properties",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": ["get", "color"],
            "circle-radius": 7,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#ffffff",
          },
        });

        map.on("click", "unclustered", (event) => {
          const feature = event.features?.[0];
          if (!feature || feature.geometry.type !== "Point" || !map) return;
          const [lng, lat] = feature.geometry.coordinates as [number, number];
          new maplibregl.Popup()
            .setLngLat([lng, lat])
            .setText(String(feature.properties?.name ?? ""))
            .addTo(map);
        });
      });
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
      aria-label="Clustered map of property locations coloured by lifecycle status"
      className="h-[420px] w-full overflow-hidden rounded-lg border border-border"
    />
  );
}
