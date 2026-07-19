import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProperty,
  listEvents,
  listEvidenceForEvents,
  listProperties,
  listSourceListings,
} from "@bai/db";
import {
  canManageOrganization,
  roundCoordinate,
  type EventEvidenceItem,
} from "@bai/domain";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@bai/ui";
import { loadTenancyContext } from "@/lib/tenancy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { PageHeader } from "../../_components/page-parts";
import { LifecycleBadge } from "../../_components/lifecycle-badge";
import { EvidenceSheet } from "../../_components/evidence-sheet";
import { MergeControl } from "./merge-control";

export const metadata: Metadata = { title: "Property" };

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await loadTenancyContext(); // ensures an authenticated tenancy context
  const supabase = await createSupabaseServerClient();

  const property = await getProperty(supabase, id);
  if (!property) {
    notFound();
  }

  const canMerge = ctx?.selectedOrganization
    ? canManageOrganization(ctx.selectedOrganization.role)
    : false;
  const mergeCandidates = canMerge
    ? (await listProperties(supabase, property.datasetId))
        .items.filter((candidate) => candidate.id !== property.id)
        .map((candidate) => ({ id: candidate.id, name: candidate.canonicalName }))
    : [];

  const [listings, events] = await Promise.all([
    listSourceListings(supabase, property.id),
    listEvents(supabase, property.datasetId, {
      filters: { propertyId: property.id },
    }),
  ]);
  const evidence = await listEvidenceForEvents(
    supabase,
    events.items.map((e) => e.id),
  );
  const evidenceByEvent = new Map<string, EventEvidenceItem[]>();
  for (const item of evidence) {
    const list = evidenceByEvent.get(item.eventId) ?? [];
    list.push(item);
    evidenceByEvent.set(item.eventId, list);
  }

  const lat =
    property.latitude !== null ? roundCoordinate(property.latitude) : null;
  const lng =
    property.longitude !== null ? roundCoordinate(property.longitude) : null;

  return (
    <div>
      <PageHeader
        title={property.canonicalName}
        description={`${property.regionName ?? "Unknown region"} · ${property.propertyType ?? "property"}`}
        actions={<LifecycleBadge status={property.currentLifecycleStatus} />}
      />
      <Link
        href="/app/properties"
        className="mb-4 inline-block text-sm text-muted-foreground hover:underline"
      >
        ← Back to properties
      </Link>

      <Tabs defaultValue="overview" className="mt-2">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="listings">
            Listings ({listings.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            History ({events.items.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Fact label="Bedrooms" value={property.bedrooms} />
                <Fact label="Bathrooms" value={property.bathrooms} />
                <Fact label="Guest capacity" value={property.guestCapacity} />
                <Fact
                  label="Coordinates (rounded)"
                  value={lat !== null && lng !== null ? `${lat}, ${lng}` : "—"}
                />
                <Fact
                  label="First observed"
                  value={formatDate(property.firstObservedAt)}
                />
                <Fact
                  label="Last observed"
                  value={formatDate(property.lastObservedAt)}
                />
                <Fact
                  label="Official website"
                  value={property.officialWebsite ?? "—"}
                />
                <Fact
                  label="Direct booking"
                  value={property.directBookingUrl ?? "—"}
                />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="listings">
          {listings.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No source listings for this property.
            </p>
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Lifecycle</TableHead>
                    <TableHead>Last observed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listings.map((listing) => (
                    <TableRow key={listing.id}>
                      <TableCell className="font-medium">
                        {listing.currentTitle ?? listing.externalId}
                      </TableCell>
                      <TableCell>
                        {listing.currentObservationStatus ? (
                          <Badge variant="outline">
                            {humanize(listing.currentObservationStatus)}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <LifecycleBadge
                          status={listing.currentLifecycleStatus}
                        />
                      </TableCell>
                      <TableCell>
                        {formatDate(listing.lastObservedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {events.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No events recorded for this property yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {events.items.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {humanize(event.eventType)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(event.eventAt)}
                      </span>
                    </div>
                    <span className="font-medium">{event.title}</span>
                    {event.summary ? (
                      <span className="text-sm text-muted-foreground">
                        {event.summary}
                      </span>
                    ) : null}
                  </div>
                  <EvidenceSheet
                    eventTitle={event.title}
                    evidence={evidenceByEvent.get(event.id) ?? []}
                  />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {canMerge ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Resolve duplicate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Merge this property into a canonical one. Snapshots and source
              listings are preserved; the duplicate is archived and the action is
              audited.
            </p>
            <MergeControl propertyId={property.id} candidates={mergeCandidates} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Fact({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value ?? "—"}</dd>
    </div>
  );
}
