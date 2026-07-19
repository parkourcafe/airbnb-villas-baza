import type { Metadata } from "next";
import Link from "next/link";
import { listProperties } from "@bai/db";
import { roundCoordinate } from "@bai/domain";
import { loadTenancyContext } from "@/lib/tenancy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "../_components/page-parts";
import { MapView, type MapPointData } from "./map-view";

export const metadata: Metadata = { title: "Map" };

export default async function MapPage() {
  const ctx = await loadTenancyContext();
  const dataset = ctx?.selectedDataset ?? null;

  if (!dataset) {
    return (
      <div>
        <PageHeader title="Map" />
        <EmptyState
          title="No dataset selected"
          description="Select a dataset to see its properties on the map."
        />
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const page = await listProperties(supabase, dataset.id, {
    page: { limit: 200 },
  });

  // Coordinates are rounded to the permitted precision before leaving the server.
  const points: MapPointData[] = page.items
    .filter((p) => p.latitude !== null && p.longitude !== null)
    .map((p) => ({
      id: p.id,
      name: p.canonicalName,
      latitude: roundCoordinate(p.latitude as number),
      longitude: roundCoordinate(p.longitude as number),
      lifecycleStatus: p.currentLifecycleStatus,
    }));

  const styleUrl = process.env.MAP_STYLE_URL || null;

  return (
    <div>
      <PageHeader
        title="Map"
        description={`Property locations in ${dataset.name}. Coordinates are rounded to protect precision.`}
      />

      {points.length === 0 ? (
        <EmptyState
          title="No mapped properties"
          description="No properties in this dataset have coordinates yet."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <MapView points={points} styleUrl={styleUrl} />

          {!styleUrl ? (
            <p className="text-sm text-muted-foreground">
              No map tile provider is configured (<code>MAP_STYLE_URL</code>),
              so the accessible list below is shown instead.
            </p>
          ) : null}

          {/* Accessible, keyboard-navigable alternative to the map. */}
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {points.map((point) => (
              <li key={point.id}>
                <Link
                  href={`/app/properties/${point.id}`}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/50"
                >
                  <span className="font-medium">{point.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {point.latitude}, {point.longitude}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
