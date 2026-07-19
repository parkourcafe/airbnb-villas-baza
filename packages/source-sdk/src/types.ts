import type {
  ObservationStatus,
  PriceUnit,
  SourceAccessMode,
  SourceCapability,
  SourceComplianceStatus,
} from "@bai/domain";

/**
 * Source adapter contract (see 02_SYSTEM_ARCHITECTURE section 7). No
 * source-specific logic lives in core packages; concrete adapters are added
 * from milestone 8 and must pass the compliance gate before `collect` runs.
 */
export interface SourceAdapterDefinition {
  key: string;
  displayName: string;
  accessMode: SourceAccessMode;
  complianceStatus: SourceComplianceStatus;
  automationAllowed: boolean;
  capabilities: SourceCapability[];
  parserVersion: string;
  /** ISO date by which the source's compliance review expires, if any. */
  reviewExpiresAt?: string;
}

export interface CollectionPlan {
  sourceKey: string;
  datasetId: string;
  regionIds?: string[];
  externalIds?: string[];
  requestedAt: string;
  requestedBy: string;
  configuration: Record<string, unknown>;
  /** Capabilities the caller intends to use during this run. */
  requestedCapabilities?: SourceCapability[];
}

export interface RawObservation {
  sourceKey: string;
  externalId: string;
  observedAt: string;
  observationStatus: ObservationStatus;
  sourceUrl?: string;
  payload: unknown;
  evidence: {
    method: string;
    requestId?: string;
    objectPath?: string;
    notes?: string;
  };
}

export interface NormalizedListingObservation {
  sourceKey: string;
  externalId: string;
  sourceUrl?: string;
  observedAt: string;
  observationStatus: ObservationStatus;

  title?: string;
  propertyType?: string;
  regionName?: string;
  latitude?: number;
  longitude?: number;

  rating?: number;
  reviewCount?: number;
  observedPrice?: {
    amount: string;
    currency: string;
    unit: PriceUnit;
  };

  bedrooms?: number;
  bathrooms?: number;
  guestCapacity?: number;

  isSuperhost?: boolean;
  hostExternalId?: string;

  officialWebsite?: string;
  businessWhatsapp?: string;
  directBookingUrl?: string;

  titleHash?: string;
  descriptionHash?: string;
  photosHash?: string;
  amenitiesHash?: string;
  contentFingerprint: string;

  parserVersion: string;
  rawEvidenceObjectPath?: string;
}

export interface HealthCheckResult {
  ok: boolean;
  checkedAt: string;
  message?: string;
}

export interface SourceAdapter {
  definition: SourceAdapterDefinition;
  validateConfiguration(config: Record<string, unknown>): Promise<void>;
  healthCheck(): Promise<HealthCheckResult>;
  collect(
    plan: CollectionPlan,
    signal: AbortSignal,
  ): AsyncIterable<RawObservation>;
  normalize(observation: RawObservation): Promise<NormalizedListingObservation>;
}
