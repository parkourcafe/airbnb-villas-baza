import type {
  AccessLevel,
  CollectionJobState,
  CollectionMode,
  Confidence,
  DatasetStatus,
  EventType,
  LifecycleStatus,
  ListingVerificationStatus,
  ManualActionReason,
  MemberRole,
  ObservationStatus,
  SearchCellStatus,
  SnapshotQualityStatus,
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

export interface SnapshotFieldDiff {
  fieldName: string;
  changeKind: string;
  previousValue: unknown;
  currentValue: unknown;
  absoluteDelta: number | null;
  percentDelta: number | null;
  isMaterial: boolean;
  ruleVersion: string;
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

/**
 * Browser-operated collection entity shapes (Milestone 11). The database row
 * types live in `@bai/db`; these are the domain-level representations shared by
 * the web app and the local collector worker.
 */
export interface CollectionJobSummary {
  id: string;
  datasetId: string;
  source: string;
  market: string;
  mode: CollectionMode;
  state: CollectionJobState;
  headed: boolean;
  collectDetails: boolean;
  maxListings: number | null;
  minRating: number | null;
  minReviewCount: number | null;
  requestedStartAt: string | null;
  manualActionReason: ManualActionReason | null;
  manualActionDetail: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastHeartbeatAt: string | null;
}

export interface CollectionJobMetrics {
  plannedCells: number;
  completedCells: number;
  cardsDiscovered: number;
  uniqueListings: number;
  duplicateDiscoveries: number;
  detailPagesCompleted: number;
  warnings: number;
  errors: number;
  currentArea: string | null;
  currentCell: string | null;
}

export interface CollectionJobDetail
  extends CollectionJobSummary, CollectionJobMetrics {
  selectedAreas: string[];
}

export interface SearchCellSummary {
  id: string;
  collectionId: string;
  parentArea: string;
  north: number;
  south: number;
  east: number;
  west: number;
  zoom: number;
  status: SearchCellStatus;
  listingsDiscovered: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface CollectionObservationSummary {
  id: string;
  collectionId: string;
  source: string;
  sourceListingId: string;
  sourceUrl: string | null;
  title: string | null;
  area: string | null;
  rating: number | null;
  reviewCount: number | null;
  displayedPrice: string | null;
  currency: string | null;
  guestCapacity: number | null;
  bedrooms: number | null;
  latitude: number | null;
  longitude: number | null;
  detailCollected: boolean;
  observedAt: string;
}

export interface MarketSnapshotSummary {
  id: string;
  datasetId: string;
  collectionId: string | null;
  source: string;
  market: string;
  observationStartedAt: string | null;
  observationCompletedAt: string | null;
  uniqueListingCount: number;
  searchCellCoverage: number;
  completionPercentage: number;
  qualityStatus: SnapshotQualityStatus;
  warningCount: number;
  checksum: string;
  createdAt: string;
}

export interface ListingVerificationSummary {
  id: string;
  collectionId: string;
  sourceListingId: string;
  sourceUrl: string | null;
  status: ListingVerificationStatus;
  observedAt: string;
}
