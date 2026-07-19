import type { ObservationStatus, PriceUnit } from "@bai/domain";
import { buildSnapshot } from "@bai/snapshot-engine";
import { assertSourceExecutionAllowed } from "../compliance";
import type {
  CollectionPlan,
  HealthCheckResult,
  NormalizedListingObservation,
  RawObservation,
  SourceAdapter,
  SourceAdapterDefinition,
} from "../types";
import { validateRequiredConfig } from "../validate";

/** One controlled fixture listing the adapter can emit. */
export interface FixtureListing {
  externalId: string;
  observationStatus: ObservationStatus;
  sourceUrl?: string;
  title?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewCount?: number;
  price?: { amount: string; currency: string; unit: PriceUnit };
  hostExternalId?: string;
  directBookingUrl?: string;
}

/**
 * A default controlled fixture set exercising the three observation shapes the
 * lifecycle engine must distinguish: a healthy active listing, a direct
 * not-found, and a source error. No network access ever occurs.
 */
export const DEFAULT_FIXTURE_LISTINGS: FixtureListing[] = [
  {
    externalId: "fixture-active-1",
    observationStatus: "active",
    sourceUrl: "https://fixtures.local/listings/active-1",
    title: "Fixture Villa Active",
    latitude: -8.409,
    longitude: 115.188,
    rating: 4.8,
    reviewCount: 120,
    price: { amount: "3500000", currency: "IDR", unit: "night" },
    hostExternalId: "fixture-host-1",
  },
  {
    externalId: "fixture-missing-1",
    observationStatus: "not_found",
  },
  {
    externalId: "fixture-error-1",
    observationStatus: "source_error",
  },
];

const FIXTURE_PARSER_VERSION = "fixture-adapter:v1";

/**
 * The fixture source adapter (8.2). It reads a controlled in-memory fixture set
 * (overridable via `configuration.listings`) and simulates active/not-found/
 * error observations. It is approved + automation-allowed so it can exercise the
 * full worker pipeline in tests without touching any third-party service.
 */
export class FixtureSourceAdapter implements SourceAdapter {
  readonly definition: SourceAdapterDefinition = {
    key: "demo_fixture",
    displayName: "Demo Fixture",
    accessMode: "demo_fixture",
    complianceStatus: "approved",
    automationAllowed: true,
    capabilities: [
      "listing_identity",
      "listing_status",
      "title",
      "rating",
      "review_count",
      "price",
      "location",
      "host_identity",
      "direct_channels",
      "content_fingerprint",
    ],
    parserVersion: FIXTURE_PARSER_VERSION,
  };

  private readonly listings: FixtureListing[];

  constructor(listings: FixtureListing[] = DEFAULT_FIXTURE_LISTINGS) {
    this.listings = listings;
  }

  async validateConfiguration(config: Record<string, unknown>): Promise<void> {
    validateRequiredConfig(config, [], {
      listings: (value) => value === undefined || Array.isArray(value),
    });
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return {
      ok: true,
      checkedAt: nowIso(),
      message: `${this.listings.length} fixture listings available`,
    };
  }

  async *collect(
    plan: CollectionPlan,
    signal: AbortSignal,
  ): AsyncIterable<RawObservation> {
    // The gate is enforced by the worker, but the adapter self-guards too so it
    // can never emit observations for a non-approved source.
    assertSourceExecutionAllowed(this.definition, {
      automated: true,
      requestedCapabilities: plan.requestedCapabilities,
    });

    const configured = plan.configuration.listings as
      | FixtureListing[]
      | undefined;
    const listings = configured ?? this.listings;
    const wanted = plan.externalIds ? new Set(plan.externalIds) : null;

    for (const listing of listings) {
      if (signal.aborted) return;
      if (wanted && !wanted.has(listing.externalId)) continue;
      yield {
        sourceKey: this.definition.key,
        externalId: listing.externalId,
        observedAt: plan.requestedAt,
        observationStatus: listing.observationStatus,
        sourceUrl: listing.sourceUrl,
        payload: listing,
        evidence: { method: "fixture", notes: "controlled fixture data" },
      };
    }
  }

  async normalize(
    observation: RawObservation,
  ): Promise<NormalizedListingObservation> {
    const listing = observation.payload as FixtureListing;
    const collected = observation.observationStatus === "active";
    const built = buildSnapshot({
      observedAt: observation.observedAt,
      observationStatus: observation.observationStatus,
      parserVersion: FIXTURE_PARSER_VERSION,
      title: collected ? listing.title : undefined,
      latitude: collected ? listing.latitude : undefined,
      longitude: collected ? listing.longitude : undefined,
      rating: collected ? listing.rating : undefined,
      reviewCount: collected ? listing.reviewCount : undefined,
      price: collected ? listing.price : undefined,
      hostExternalId: collected ? listing.hostExternalId : undefined,
      directBookingUrl: collected ? listing.directBookingUrl : undefined,
    });

    return {
      sourceKey: observation.sourceKey,
      externalId: observation.externalId,
      sourceUrl: observation.sourceUrl,
      observedAt: observation.observedAt,
      observationStatus: observation.observationStatus,
      title: built.title ?? undefined,
      latitude: built.latitude ?? undefined,
      longitude: built.longitude ?? undefined,
      rating: built.rating ?? undefined,
      reviewCount: built.reviewCount ?? undefined,
      observedPrice: built.price ?? undefined,
      hostExternalId: built.hostExternalId ?? undefined,
      directBookingUrl: built.directBookingUrl ?? undefined,
      titleHash: built.titleHash ?? undefined,
      contentFingerprint: built.contentFingerprint,
      parserVersion: FIXTURE_PARSER_VERSION,
      rawEvidenceObjectPath: observation.evidence.objectPath,
    };
  }
}

function nowIso(): string {
  // Adapters may read wall-clock time; kept in a helper for easy stubbing.
  return new Date().toISOString();
}
