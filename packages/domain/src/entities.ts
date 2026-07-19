import type {
  AccessLevel,
  Confidence,
  DatasetStatus,
  EventType,
  LifecycleStatus,
  MemberRole,
  ObservationStatus,
} from "./enums";

/**
 * Identity and tenancy entity shapes (Milestone 1). These are the domain-level
 * representations; the database row types live in `@bai/db`.
 */
export interface Profile {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  timezone: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: string;
  planCode: string;
  defaultTimezone: string;
}

export interface OrganizationMembership {
  organizationId: string;
  userId: string;
  role: MemberRole;
}

/** An organization the current user belongs to, with their role in it. */
export interface OrganizationWithRole extends Organization {
  role: MemberRole;
}

export interface Dataset {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: DatasetStatus;
  isDemo: boolean;
}

/** A dataset the current organization can reach, with the access level. */
export interface DatasetWithAccess extends Dataset {
  accessLevel: AccessLevel;
}

/**
 * Catalogue entity shapes (Milestone 2). Coordinates are pre-rounded to the
 * permitted precision before they leave the server.
 */
export interface Region {
  id: string;
  name: string;
  slug: string;
  regionType: string | null;
  parentId: string | null;
}

export interface PropertySummary {
  id: string;
  canonicalName: string;
  propertyType: string | null;
  regionId: string | null;
  regionName: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  guestCapacity: number | null;
  currentLifecycleStatus: LifecycleStatus | null;
  currentConfidence: Confidence | null;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
}

export interface PropertyDetail extends PropertySummary {
  datasetId: string;
  slug: string | null;
  officialWebsite: string | null;
  businessWhatsapp: string | null;
  directBookingUrl: string | null;
  coordinatePrecisionMeters: number | null;
}

export interface SourceListingSummary {
  id: string;
  propertyId: string;
  sourceId: string;
  externalId: string;
  sourceUrl: string | null;
  currentTitle: string | null;
  currentObservationStatus: ObservationStatus | null;
  currentLifecycleStatus: LifecycleStatus | null;
  firstSeenAt: string;
  lastObservedAt: string;
}

export interface ListingSnapshotSummary {
  id: string;
  sourceListingId: string;
  observedAt: string;
  observationStatus: ObservationStatus;
  title: string | null;
  rating: number | null;
  reviewCount: number | null;
  observedPriceAmount: string | null;
  observedPriceCurrency: string | null;
  observedPriceUnit: string | null;
  isSuperhost: boolean | null;
}

export interface CatalogueEvent {
  id: string;
  propertyId: string;
  sourceListingId: string | null;
  eventType: EventType | string;
  eventAt: string;
  confidence: Confidence | null;
  title: string;
  summary: string | null;
  isReviewed: boolean;
  dismissedAt: string | null;
}

export interface EventEvidenceItem {
  id: string;
  evidenceType: string;
  explanation: string;
  previousSnapshotId: string | null;
  currentSnapshotId: string | null;
  collectionRunId: string | null;
}

export interface DatasetOverview {
  properties: number;
  activeListings: number;
  suspectedInactive: number;
  confirmedInactive: number;
  events: number;
}
