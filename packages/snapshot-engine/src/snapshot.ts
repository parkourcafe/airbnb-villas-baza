import type { Money, ObservationStatus } from "@bai/domain";
import { roundCoordinate } from "@bai/domain";
import { SNAPSHOT_FIELDS } from "./fields";
import {
  contentHash,
  normalizeSet,
  normalizedHash,
  normalizeText,
  normalizeUrl,
  setHash,
} from "./normalize";

/**
 * The rule version for the snapshot normalizer. Stored on every snapshot so a
 * later change to normalization does not silently rewrite history (04 §13).
 */
export const SNAPSHOT_NORMALIZER_VERSION = "snapshot-normalizer:v1";

/**
 * A single observation as collected by a source adapter or an import row,
 * before it becomes an immutable snapshot.
 *
 * Field presence convention (04 §12): a property left `undefined` was **not
 * collected** by the adapter and is excluded from diffing; a property set to
 * `null` was **collected but absent** (e.g. a direct booking URL that was
 * removed) and does participate in diffing.
 */
export interface SnapshotObservation {
  observedAt: string;
  observationStatus: ObservationStatus;
  parserVersion: string;
  title?: string | null;
  description?: string | null;
  photos?: readonly string[] | null;
  amenities?: readonly string[] | null;
  propertyType?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  price?: Money | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  guestCapacity?: number | null;
  isSuperhost?: boolean | null;
  hostExternalId?: string | null;
  officialWebsite?: string | null;
  businessWhatsapp?: string | null;
  directBookingUrl?: string | null;
}

/** Normalized, comparable values plus the derived fingerprints for a snapshot. */
export interface BuiltSnapshot {
  observedAt: string;
  observationStatus: ObservationStatus;
  parserVersion: string;
  normalizerVersion: string;
  title: string | null;
  propertyType: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  reviewCount: number | null;
  price: Money | null;
  bedrooms: number | null;
  bathrooms: number | null;
  guestCapacity: number | null;
  isSuperhost: boolean | null;
  hostExternalId: string | null;
  officialWebsite: string | null;
  businessWhatsapp: string | null;
  directBookingUrl: string | null;
  amenities: string[] | null;
  titleHash: string | null;
  descriptionHash: string | null;
  photosHash: string | null;
  amenitiesHash: string | null;
  contentFingerprint: string;
  fieldPresence: Record<string, boolean>;
  qualityFlags: string[];
}

/** True when the observation collected this field (even if collected as null). */
function collected(value: unknown): boolean {
  return value !== undefined;
}

function hashOf(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : normalizedHash(value);
}

function photosHashOf(
  value: readonly string[] | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  // Photo identity is an ordered list of stable identifiers/fingerprints.
  return contentHash(value.map((p) => p.trim()).join("\n"));
}

function normalizeUrlValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return normalizeUrl(value);
}

function normalizeTextValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = normalizeText(value);
  return normalized === "" ? null : normalized;
}

/**
 * Build the normalized values, fingerprints, field-presence map and quality
 * flags for one observation. Pure and deterministic: the same observation
 * always yields the same fingerprint (idempotency, 04 §14), and `observed_at`
 * never contributes to the content fingerprint.
 */
export function buildSnapshot(obs: SnapshotObservation): BuiltSnapshot {
  const title = normalizeTextValue(obs.title);
  const propertyType = normalizeTextValue(obs.propertyType);
  const hostExternalId = normalizeTextValue(obs.hostExternalId);
  const businessWhatsapp = normalizeTextValue(obs.businessWhatsapp);
  const officialWebsite = normalizeUrlValue(obs.officialWebsite);
  const directBookingUrl = normalizeUrlValue(obs.directBookingUrl);
  let amenities: string[] | null;
  if (obs.amenities === undefined) {
    amenities = null; // not collected
  } else if (obs.amenities === null) {
    amenities = []; // collected, empty set
  } else {
    amenities = normalizeSet(obs.amenities);
  }

  const latitude =
    obs.latitude === null || obs.latitude === undefined
      ? null
      : roundCoordinate(obs.latitude);
  const longitude =
    obs.longitude === null || obs.longitude === undefined
      ? null
      : roundCoordinate(obs.longitude);

  const titleHash = hashOf(obs.title);
  const descriptionHash = hashOf(obs.description);
  const photosHash = photosHashOf(obs.photos);
  const amenitiesHash =
    obs.amenities === null || obs.amenities === undefined
      ? null
      : setHash(obs.amenities);

  const fieldPresence: Record<string, boolean> = {};
  for (const spec of SNAPSHOT_FIELDS) {
    fieldPresence[spec.name] = presenceFor(spec.name, obs);
  }

  const qualityFlags = computeQualityFlags(obs);

  const contentFingerprint = computeContentFingerprint({
    observationStatus: obs.observationStatus,
    title,
    propertyType,
    titleHash,
    descriptionHash,
    photosHash,
    amenitiesHash,
    latitude,
    longitude,
    rating: obs.rating ?? null,
    reviewCount: obs.reviewCount ?? null,
    price: obs.price ?? null,
    bedrooms: obs.bedrooms ?? null,
    bathrooms: obs.bathrooms ?? null,
    guestCapacity: obs.guestCapacity ?? null,
    isSuperhost: obs.isSuperhost ?? null,
    hostExternalId,
    officialWebsite,
    businessWhatsapp,
    directBookingUrl,
  });

  return {
    observedAt: obs.observedAt,
    observationStatus: obs.observationStatus,
    parserVersion: obs.parserVersion,
    normalizerVersion: SNAPSHOT_NORMALIZER_VERSION,
    title,
    propertyType,
    latitude,
    longitude,
    rating: obs.rating ?? null,
    reviewCount: obs.reviewCount ?? null,
    price: obs.price ?? null,
    bedrooms: obs.bedrooms ?? null,
    bathrooms: obs.bathrooms ?? null,
    guestCapacity: obs.guestCapacity ?? null,
    isSuperhost: obs.isSuperhost ?? null,
    hostExternalId,
    officialWebsite,
    businessWhatsapp,
    directBookingUrl,
    amenities,
    titleHash,
    descriptionHash,
    photosHash,
    amenitiesHash,
    contentFingerprint,
    fieldPresence,
    qualityFlags,
  };
}

function presenceFor(name: string, obs: SnapshotObservation): boolean {
  switch (name) {
    case "title":
      return collected(obs.title);
    case "description":
      return collected(obs.description);
    case "photos":
      return collected(obs.photos);
    case "amenities":
      return collected(obs.amenities);
    case "property_type":
      return collected(obs.propertyType);
    case "location":
      return collected(obs.latitude) && collected(obs.longitude);
    case "rating":
      return collected(obs.rating);
    case "review_count":
      return collected(obs.reviewCount);
    case "price":
      return collected(obs.price);
    case "bedrooms":
      return collected(obs.bedrooms);
    case "bathrooms":
      return collected(obs.bathrooms);
    case "guest_capacity":
      return collected(obs.guestCapacity);
    case "is_superhost":
      return collected(obs.isSuperhost);
    case "host_external_id":
      return collected(obs.hostExternalId);
    case "official_website":
      return collected(obs.officialWebsite);
    case "business_whatsapp":
      return collected(obs.businessWhatsapp);
    case "direct_booking_url":
      return collected(obs.directBookingUrl);
    default:
      return false;
  }
}

/**
 * Per-observation data-quality flags. These describe THIS observation only and
 * never assert a legal cause (AGENTS.md observation-language rule). Sorted for
 * a deterministic result.
 */
function computeQualityFlags(obs: SnapshotObservation): string[] {
  const flags = new Set<string>();
  if (
    obs.rating !== null &&
    obs.rating !== undefined &&
    (obs.rating < 0 || obs.rating > 5)
  ) {
    flags.add("rating_out_of_range");
  }
  if (
    obs.reviewCount !== null &&
    obs.reviewCount !== undefined &&
    obs.reviewCount < 0
  ) {
    flags.add("negative_review_count");
  }
  if (
    obs.price !== null &&
    obs.price !== undefined &&
    !/^[A-Z]{3}$/.test(obs.price.currency)
  ) {
    flags.add("unknown_currency");
  }
  if (obs.officialWebsite && normalizeUrl(obs.officialWebsite) === null) {
    flags.add("invalid_url");
  }
  if (obs.directBookingUrl && normalizeUrl(obs.directBookingUrl) === null) {
    flags.add("invalid_url");
  }
  return [...flags].sort();
}

interface FingerprintInput {
  observationStatus: ObservationStatus;
  title: string | null;
  propertyType: string | null;
  titleHash: string | null;
  descriptionHash: string | null;
  photosHash: string | null;
  amenitiesHash: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  reviewCount: number | null;
  price: Money | null;
  bedrooms: number | null;
  bathrooms: number | null;
  guestCapacity: number | null;
  isSuperhost: boolean | null;
  hostExternalId: string | null;
  officialWebsite: string | null;
  businessWhatsapp: string | null;
  directBookingUrl: string | null;
}

/**
 * A deterministic fingerprint of the salient content of a snapshot. Two
 * observations with identical content (ignoring observation time) share a
 * fingerprint, which the diff engine and idempotency checks rely on.
 */
function computeContentFingerprint(input: FingerprintInput): string {
  const priceToken = input.price
    ? `${input.price.amount}|${input.price.currency}|${input.price.unit}`
    : "";
  const parts = [
    `status=${input.observationStatus}`,
    `title=${input.titleHash ?? ""}`,
    `description=${input.descriptionHash ?? ""}`,
    `photos=${input.photosHash ?? ""}`,
    `amenities=${input.amenitiesHash ?? ""}`,
    `property_type=${input.propertyType ?? ""}`,
    `lat=${input.latitude ?? ""}`,
    `lng=${input.longitude ?? ""}`,
    `rating=${input.rating ?? ""}`,
    `review_count=${input.reviewCount ?? ""}`,
    `price=${priceToken}`,
    `bedrooms=${input.bedrooms ?? ""}`,
    `bathrooms=${input.bathrooms ?? ""}`,
    `guest_capacity=${input.guestCapacity ?? ""}`,
    `is_superhost=${input.isSuperhost ?? ""}`,
    `host=${input.hostExternalId ?? ""}`,
    `official_website=${input.officialWebsite ?? ""}`,
    `business_whatsapp=${input.businessWhatsapp ?? ""}`,
    `direct_booking_url=${input.directBookingUrl ?? ""}`,
  ];
  return contentHash(parts.join("\n"));
}
