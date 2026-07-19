import type { JSONValue, Sql, TransactionSql } from "postgres";
import type { Money, PriceUnit } from "@bai/domain";
import {
  type BuiltSnapshot,
  buildSnapshot,
  DEFAULT_MATERIALITY,
  type FieldDiff,
  diffSnapshots,
  type SnapshotObservation,
} from "@bai/snapshot-engine";
import {
  fieldChangeEvents,
  type LifecycleObservation,
  type LifecycleState,
  reduceLifecycle,
} from "@bai/event-engine";
import type { ParsedImportRow } from "@bai/import-engine";
import {
  auxState,
  insertEvent,
  type LifecycleListingRow,
  newListingState,
  stateFromRow,
} from "./lifecycle-persistence";

/** Context shared by every accepted row in one import/collection run. */
export interface SnapshotPersistCtx {
  datasetId: string;
  sourceId: string;
  runId: string;
  parserVersion: string;
  /** The collection run is degraded; lifecycle transitions are suppressed. */
  runDegraded?: boolean;
}

const PRICE_UNITS: readonly PriceUnit[] = ["night", "stay", "unknown"];

function toPriceUnit(value: string | undefined): PriceUnit {
  return value && (PRICE_UNITS as readonly string[]).includes(value)
    ? (value as PriceUnit)
    : "unknown";
}

/**
 * Map a validated import row to a snapshot observation. Fields the CSV does not
 * carry (description/photos/amenities/property_type) are left `undefined` — i.e.
 * "not collected" — so they never produce false diffs (04 §12). A price is only
 * built when both amount and currency are present, otherwise it is treated as
 * not collected.
 */
export function observationFromImportRow(
  row: ParsedImportRow,
  parserVersion: string,
): SnapshotObservation {
  let price: Money | undefined;
  if (row.observedPriceAmount && row.observedPriceCurrency) {
    price = {
      amount: row.observedPriceAmount,
      currency: row.observedPriceCurrency,
      unit: toPriceUnit(row.observedPriceUnit),
    };
  }
  return {
    observedAt: row.observedAt,
    observationStatus: row.observationStatus,
    parserVersion,
    title: row.title,
    latitude: row.latitude,
    longitude: row.longitude,
    rating: row.rating,
    reviewCount: row.reviewCount,
    price,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    guestCapacity: row.guestCapacity,
    isSuperhost: row.isSuperhost,
    hostExternalId: row.hostExternalId,
    officialWebsite: row.officialWebsite,
    businessWhatsapp: row.businessWhatsapp,
    directBookingUrl: row.directBookingUrl,
  };
}

interface SnapshotRow {
  id: string;
  observed_at: string;
  observation_status: string;
  parser_version: string;
  field_presence: Record<string, boolean>;
  title_hash: string | null;
  description_hash: string | null;
  photos_hash: string | null;
  amenities_hash: string | null;
  property_type: string | null;
  latitude: string | null;
  longitude: string | null;
  rating: string | null;
  review_count: number | null;
  observed_price_amount: string | null;
  observed_price_currency: string | null;
  observed_price_unit: string | null;
  bedrooms: string | null;
  bathrooms: string | null;
  guest_capacity: number | null;
  is_superhost: boolean | null;
  host_external_id: string | null;
  official_website: string | null;
  business_whatsapp: string | null;
  direct_booking_url: string | null;
}

const num = (value: string | number | null): number | null =>
  value === null ? null : Number(value);

/** Coerce an engine diff value (already JSON-serializable) to a jsonb parameter. */
const asJson = (value: unknown): JSONValue => (value ?? null) as JSONValue;

/**
 * Rebuild a `BuiltSnapshot` from a stored snapshot row so it can be diffed
 * against the current observation. Content fields the CSV path does not collect
 * (amenities/description/photos) are absent from `field_presence` and therefore
 * never diffed, so their un-stored arrays are irrelevant here.
 */
function snapshotFromRow(row: SnapshotRow): BuiltSnapshot {
  const price: Money | null =
    row.observed_price_amount && row.observed_price_currency
      ? {
          amount: row.observed_price_amount,
          currency: row.observed_price_currency,
          unit: toPriceUnit(row.observed_price_unit ?? undefined),
        }
      : null;
  return {
    observedAt: row.observed_at,
    observationStatus:
      row.observation_status as SnapshotObservation["observationStatus"],
    parserVersion: row.parser_version,
    normalizerVersion: "",
    title: null,
    propertyType: row.property_type,
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    rating: num(row.rating),
    reviewCount: row.review_count,
    price,
    bedrooms: num(row.bedrooms),
    bathrooms: num(row.bathrooms),
    guestCapacity: row.guest_capacity,
    isSuperhost: row.is_superhost,
    hostExternalId: row.host_external_id,
    officialWebsite: row.official_website,
    businessWhatsapp: row.business_whatsapp,
    directBookingUrl: row.direct_booking_url,
    amenities: null,
    titleHash: row.title_hash,
    descriptionHash: row.description_hash,
    photosHash: row.photos_hash,
    amenitiesHash: row.amenities_hash,
    contentFingerprint: "",
    fieldPresence: row.field_presence ?? {},
    qualityFlags: [],
  };
}

/**
 * Resolve the source listing for an accepted row, creating the canonical
 * property on first sight. MVP canonical resolution (04 §4.3): an explicit
 * `canonical_property_key` reuses the matching property (via `property_aliases`),
 * otherwise a new property is created per new source listing.
 */
interface ResolvedListing {
  id: string;
  propertyId: string;
  isNew: boolean;
  state: LifecycleState;
}

async function resolveSourceListing(
  tx: TransactionSql,
  ctx: SnapshotPersistCtx,
  row: ParsedImportRow,
): Promise<ResolvedListing> {
  const existing = await tx<
    (LifecycleListingRow & { id: string; property_id: string })[]
  >`
    select id, property_id, current_lifecycle_status, current_confidence,
           consecutive_misses, last_seen_active_at, last_observed_at, first_miss_at,
           suspected_inactive_at, confirmed_inactive_at, reactivated_at, lifecycle_state
    from public.source_listings
    where dataset_id = ${ctx.datasetId}
      and source_id = ${ctx.sourceId}
      and external_id = ${row.externalId}
  `;
  if (existing[0]) {
    return {
      id: existing[0].id,
      propertyId: existing[0].property_id,
      isNew: false,
      state: stateFromRow(existing[0]),
    };
  }

  const propertyId = await resolveProperty(tx, ctx, row);
  const [inserted] = await tx<{ id: string }[]>`
    insert into public.source_listings
      (dataset_id, property_id, source_id, external_id, source_url, current_title,
       current_observation_status, first_seen_at, last_observed_at, last_seen_active_at,
       host_external_id, official_website, business_whatsapp, direct_booking_url)
    values
      (${ctx.datasetId}, ${propertyId}, ${ctx.sourceId}, ${row.externalId},
       ${row.sourceUrl ?? null}, ${row.title ?? null}, ${row.observationStatus},
       ${row.observedAt}, ${row.observedAt},
       ${row.observationStatus === "active" ? row.observedAt : null},
       ${row.hostExternalId ?? null}, ${row.officialWebsite ?? null},
       ${row.businessWhatsapp ?? null}, ${row.directBookingUrl ?? null})
    returning id
  `;
  return {
    id: inserted!.id,
    propertyId,
    isNew: true,
    state: newListingState(row.observedAt),
  };
}

async function resolveProperty(
  tx: TransactionSql,
  ctx: SnapshotPersistCtx,
  row: ParsedImportRow,
): Promise<string> {
  if (row.canonicalPropertyKey) {
    const match = await tx<{ property_id: string }[]>`
      select a.property_id
      from public.property_aliases a
      join public.properties p on p.id = a.property_id
      where p.dataset_id = ${ctx.datasetId} and a.alias = ${row.canonicalPropertyKey}
      limit 1
    `;
    if (match[0]) return match[0].property_id;
  }

  const canonicalName = row.title ?? `Listing ${row.externalId}`;
  const [property] = await tx<{ id: string }[]>`
    insert into public.properties
      (dataset_id, canonical_name, latitude, longitude, bedrooms, bathrooms,
       guest_capacity, official_website, business_whatsapp, direct_booking_url,
       first_observed_at, last_observed_at)
    values
      (${ctx.datasetId}, ${canonicalName}, ${row.latitude ?? null}, ${row.longitude ?? null},
       ${row.bedrooms ?? null}, ${row.bathrooms ?? null}, ${row.guestCapacity ?? null},
       ${row.officialWebsite ?? null}, ${row.businessWhatsapp ?? null},
       ${row.directBookingUrl ?? null}, ${row.observedAt}, ${row.observedAt})
    returning id
  `;
  if (row.canonicalPropertyKey) {
    await tx`
      insert into public.property_aliases (property_id, alias, source)
      values (${property!.id}, ${row.canonicalPropertyKey}, 'import')
    `;
  }
  return property!.id;
}

async function insertSnapshot(
  tx: TransactionSql,
  ctx: SnapshotPersistCtx,
  sourceListingId: string,
  built: BuiltSnapshot,
): Promise<{ id: string; created: boolean }> {
  const rows = await tx<{ id: string }[]>`
    insert into public.listing_snapshots
      (dataset_id, source_listing_id, collection_run_id, observed_at, observation_status,
       title, property_type, latitude, longitude, rating, review_count,
       observed_price_amount, observed_price_currency, observed_price_unit,
       bedrooms, bathrooms, guest_capacity, is_superhost, host_external_id,
       official_website, business_whatsapp, direct_booking_url,
       title_hash, description_hash, photos_hash, amenities_hash,
       content_fingerprint, parser_version, field_presence, quality_flags)
    values
      (${ctx.datasetId}, ${sourceListingId}, ${ctx.runId}, ${built.observedAt},
       ${built.observationStatus}, ${built.title}, ${built.propertyType},
       ${built.latitude}, ${built.longitude}, ${built.rating}, ${built.reviewCount},
       ${built.price?.amount ?? null}, ${built.price?.currency ?? null},
       ${built.price?.unit ?? null}, ${built.bedrooms}, ${built.bathrooms},
       ${built.guestCapacity}, ${built.isSuperhost}, ${built.hostExternalId},
       ${built.officialWebsite}, ${built.businessWhatsapp}, ${built.directBookingUrl},
       ${built.titleHash}, ${built.descriptionHash}, ${built.photosHash},
       ${built.amenitiesHash}, ${built.contentFingerprint}, ${built.parserVersion},
       ${tx.json(built.fieldPresence)}, ${built.qualityFlags})
    on conflict (source_listing_id, collection_run_id) do nothing
    returning id
  `;
  if (rows[0]) return { id: rows[0].id, created: true };
  // Already inserted by an earlier run of this job — idempotent replay.
  const [existing] = await tx<{ id: string }[]>`
    select id from public.listing_snapshots
    where source_listing_id = ${sourceListingId} and collection_run_id = ${ctx.runId}
  `;
  return { id: existing!.id, created: false };
}

/**
 * Select the latest earlier snapshot for the listing that is parser-compatible
 * and not from a degraded run (04 §11), reconstruct it and persist the field
 * diffs against `current`. Diffs are inserted with a unique key so a repeated
 * run never duplicates them (04 §14).
 */
interface DiffOutcome {
  previousSnapshotId: string | null;
  diffs: FieldDiff[];
}

async function persistDiffs(
  tx: TransactionSql,
  ctx: SnapshotPersistCtx,
  sourceListingId: string,
  currentSnapshotId: string,
  current: BuiltSnapshot,
): Promise<DiffOutcome> {
  const [previous] = await tx<SnapshotRow[]>`
    select s.* from public.listing_snapshots s
    join private.collection_runs r on r.id = s.collection_run_id
    where s.source_listing_id = ${sourceListingId}
      and s.observed_at < ${current.observedAt}
      and s.parser_version = ${ctx.parserVersion}
      and r.is_degraded is not true
    order by s.observed_at desc
    limit 1
  `;
  if (!previous) return { previousSnapshotId: null, diffs: [] };

  const diffs = diffSnapshots(snapshotFromRow(previous), current);
  for (const diff of diffs) {
    await tx`
      insert into public.snapshot_diffs
        (dataset_id, source_listing_id, previous_snapshot_id, current_snapshot_id,
         field_name, previous_value, current_value, change_kind, absolute_delta,
         percent_delta, is_material, rule_version)
      values
        (${ctx.datasetId}, ${sourceListingId}, ${previous.id}, ${currentSnapshotId},
         ${diff.fieldName}, ${tx.json(asJson(diff.previousValue))},
         ${tx.json(asJson(diff.currentValue))}, ${diff.changeKind},
         ${diff.absoluteDelta}, ${diff.percentDelta}, ${diff.isMaterial}, ${diff.ruleVersion})
      on conflict (current_snapshot_id, field_name, rule_version) do nothing
    `;
  }
  return { previousSnapshotId: previous.id, diffs };
}

/**
 * Persist one accepted import row as an immutable snapshot with its field diffs,
 * upserting the source listing and canonical property. Must run inside the
 * caller's transaction so the whole import stays atomic and idempotent.
 */
export async function persistAcceptedRow(
  tx: TransactionSql,
  ctx: SnapshotPersistCtx,
  row: ParsedImportRow,
): Promise<void> {
  const listing = await resolveSourceListing(tx, ctx, row);
  const built = buildSnapshot(observationFromImportRow(row, ctx.parserVersion));
  const { id: snapshotId, created } = await insertSnapshot(
    tx,
    ctx,
    listing.id,
    built,
  );
  if (!created) return; // replay: snapshot + diffs + events already persisted.

  const { previousSnapshotId, diffs } = await persistDiffs(
    tx,
    ctx,
    listing.id,
    snapshotId,
    built,
  );

  await persistEvents(
    tx,
    ctx,
    listing,
    snapshotId,
    previousSnapshotId,
    built,
    diffs,
  );
}

const firstSeenDate = (observedAt: string): string => observedAt.slice(0, 10);

/**
 * Persist the derived events for one observation: a `listing_created` event on
 * first sight, material field-change events from the diffs, and lifecycle
 * transition events from the reducer — then update the listing's authoritative
 * lifecycle projection. All events are evidence-backed and de-duplicated.
 */
async function persistEvents(
  tx: TransactionSql,
  ctx: SnapshotPersistCtx,
  listing: ResolvedListing,
  snapshotId: string,
  previousSnapshotId: string | null,
  built: BuiltSnapshot,
  diffs: FieldDiff[],
): Promise<void> {
  if (listing.isNew) {
    await insertEvent(
      tx,
      {
        datasetId: ctx.datasetId,
        propertyId: listing.propertyId,
        sourceListingId: listing.id,
        eventType: "listing_created",
        eventAt: built.observedAt,
        confidence: "high",
        dedupeKey: `listing_created:${listing.id}:${firstSeenDate(built.observedAt)}:${SNAPSHOT_RULE_VERSION}`,
        summary: "Source listing first observed.",
        ruleVersion: SNAPSHOT_RULE_VERSION,
      },
      {
        currentSnapshotId: snapshotId,
        collectionRunId: ctx.runId,
        evidenceType: "snapshot",
        explanation: "First observation snapshot for this source listing.",
      },
    );
  }

  for (const event of fieldChangeEvents(diffs, {
    sourceListingId: listing.id,
    runId: ctx.runId,
    observedAt: built.observedAt,
  })) {
    await insertEvent(
      tx,
      {
        datasetId: ctx.datasetId,
        propertyId: listing.propertyId,
        sourceListingId: listing.id,
        eventType: event.eventType,
        eventAt: event.eventAt,
        confidence: event.confidence,
        dedupeKey: event.dedupeKey,
        summary: event.explanation,
        previousValue: event.previousValue,
        currentValue: event.currentValue,
        ruleVersion: event.ruleVersion,
      },
      {
        previousSnapshotId,
        currentSnapshotId: snapshotId,
        collectionRunId: ctx.runId,
        evidenceType: "diff",
        explanation: event.explanation,
        metadata: { field: event.fieldName },
      },
    );
  }

  const observation: LifecycleObservation = {
    observationStatus: built.observationStatus,
    observedAt: built.observedAt,
    snapshotId,
    runId: ctx.runId,
  };
  const result = reduceLifecycle(listing.state, observation, listing.id, {
    runDegraded: ctx.runDegraded ?? false,
  });

  for (const event of result.events) {
    await insertEvent(
      tx,
      {
        datasetId: ctx.datasetId,
        propertyId: listing.propertyId,
        sourceListingId: listing.id,
        eventType: event.eventType,
        eventAt: event.eventAt,
        confidence: event.confidence,
        dedupeKey: event.dedupeKey,
        summary: event.explanation,
        previousValue: event.previousStatus,
        currentValue: event.currentStatus,
        ruleVersion: event.ruleVersion,
      },
      {
        currentSnapshotId: snapshotId,
        collectionRunId: ctx.runId,
        evidenceType: "lifecycle",
        explanation: event.explanation,
        metadata: {
          confidence: event.confidence,
          ruleVersion: event.ruleVersion,
        },
      },
    );
  }

  const next = result.state;
  await tx`
    update public.source_listings
    set latest_snapshot_id = ${snapshotId},
        current_title = ${built.title},
        current_observation_status = ${built.observationStatus},
        current_lifecycle_status = ${next.status},
        current_confidence = ${next.confidence},
        consecutive_misses = ${next.consecutiveMisses},
        first_miss_at = ${next.firstMissAt},
        suspected_inactive_at = ${next.suspectedInactiveAt},
        confirmed_inactive_at = ${next.confirmedInactiveAt},
        reactivated_at = ${next.reactivatedAt},
        last_observed_at = ${built.observedAt},
        last_seen_active_at = ${next.lastSeenActiveAt},
        lifecycle_state = ${tx.json(auxState(next))},
        updated_at = now()
    where id = ${listing.id}
  `;
}

/** Exposed for the DB integration test (materiality rule version tag). */
export const SNAPSHOT_RULE_VERSION = DEFAULT_MATERIALITY.version;

/** Re-export so callers can pass a live `Sql` where a `TransactionSql` is typed. */
export type { Sql };
