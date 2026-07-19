import { OBSERVATION_STATUS, type ObservationStatus } from "@bai/domain";
import {
  BALI_COVERAGE,
  isValidLatitude,
  isValidLongitude,
  isWithinCoverage,
  type ImportCoverage,
} from "./coverage";
import type { RejectionCode, RowRejection } from "./rejection";

/** A validated, typed import row (camelCase). Fed to the snapshot engine (M4). */
export interface ParsedImportRow {
  sourceKey: string;
  externalId: string;
  sourceUrl?: string;
  title?: string;
  observedAt: string;
  observationStatus: ObservationStatus;
  region?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewCount?: number;
  observedPriceAmount?: string;
  observedPriceCurrency?: string;
  observedPriceUnit?: string;
  bedrooms?: number;
  bathrooms?: number;
  guestCapacity?: number;
  isSuperhost?: boolean;
  hostExternalId?: string;
  officialWebsite?: string;
  businessWhatsapp?: string;
  directBookingUrl?: string;
  canonicalPropertyKey?: string;
}

export interface ImportValidationContext {
  /** Source keys that exist and are approved for manual import. */
  approvedSourceKeys: ReadonlySet<string>;
  coverage?: ImportCoverage;
}

export interface RowValidationResult {
  row?: ParsedImportRow;
  rejections: RowRejection[];
}

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

function parseHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function parseBoolean(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(v)) return true;
  if (["false", "0", "no", "n"].includes(v)) return false;
  return null;
}

function parseInteger(value: string): number | null {
  if (!/^-?\d+$/.test(value.trim())) return null;
  return Number.parseInt(value, 10);
}

function parseDecimal(value: string): number | null {
  if (!/^-?\d+(\.\d+)?$/.test(value.trim())) return null;
  return Number.parseFloat(value);
}

const OBSERVATION_STATUS_SET = new Set<string>(OBSERVATION_STATUS);

/**
 * Validate and normalize one raw CSV row. Returns the typed row when it is
 * acceptable, plus any rejection reasons. A row with any rejection is not
 * accepted (06_ACCEPTANCE_TESTS IMP-02).
 */
export function validateRow(
  raw: Record<string, string | undefined>,
  rowNumber: number,
  ctx: ImportValidationContext,
): RowValidationResult {
  const rejections: RowRejection[] = [];
  const reject = (code: RejectionCode, message: string, column?: string) =>
    rejections.push({ rowNumber, code, message, column });

  const sourceKey = (raw.source_key ?? "").trim();
  const externalId = (raw.external_id ?? "").trim();

  if (!ctx.approvedSourceKeys.has(sourceKey)) {
    reject(
      "unknown_source",
      `unknown or unapproved source "${sourceKey}"`,
      "source_key",
    );
  }
  if (isBlank(externalId)) {
    reject("missing_external_id", "external_id is required", "external_id");
  }

  const observedAtRaw = (raw.observed_at ?? "").trim();
  const observedAt = new Date(observedAtRaw);
  if (isBlank(observedAtRaw) || Number.isNaN(observedAt.getTime())) {
    reject(
      "invalid_timestamp",
      `invalid observed_at "${observedAtRaw}"`,
      "observed_at",
    );
  }

  const status = (raw.observation_status ?? "").trim();
  if (!OBSERVATION_STATUS_SET.has(status)) {
    reject(
      "invalid_status",
      `invalid observation_status "${status}"`,
      "observation_status",
    );
  }

  let rating: number | undefined;
  if (!isBlank(raw.rating)) {
    const parsed = parseDecimal(raw.rating as string);
    if (parsed === null || parsed < 0 || parsed > 5) {
      reject("rating_out_of_range", `rating must be within 0..5`, "rating");
    } else {
      rating = parsed;
    }
  }

  let reviewCount: number | undefined;
  if (!isBlank(raw.review_count)) {
    const parsed = parseInteger(raw.review_count as string);
    if (parsed === null || parsed < 0) {
      reject(
        "negative_review_count",
        "review_count must be >= 0",
        "review_count",
      );
    } else {
      reviewCount = parsed;
    }
  }

  let latitude: number | undefined;
  let longitude: number | undefined;
  const hasLat = !isBlank(raw.latitude);
  const hasLng = !isBlank(raw.longitude);
  if (hasLat || hasLng) {
    const lat = parseDecimal(raw.latitude ?? "");
    const lng = parseDecimal(raw.longitude ?? "");
    if (
      lat === null ||
      lng === null ||
      !isValidLatitude(lat) ||
      !isValidLongitude(lng)
    ) {
      reject(
        "invalid_coordinates",
        "latitude/longitude are not valid coordinates",
        "latitude",
      );
    } else {
      latitude = lat;
      longitude = lng;
      const coverage = ctx.coverage ?? BALI_COVERAGE;
      if (!isWithinCoverage(lat, lng, coverage)) {
        reject(
          "coordinates_outside_coverage",
          "coordinates fall outside the configured coverage",
          "latitude",
        );
      }
    }
  }

  let currency: string | undefined;
  if (!isBlank(raw.observed_price_currency)) {
    const c = (raw.observed_price_currency as string).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(c)) {
      reject(
        "unknown_currency",
        `invalid currency "${c}"`,
        "observed_price_currency",
      );
    } else {
      currency = c;
    }
  }

  const urlFields: [keyof ParsedImportRow, string][] = [
    ["sourceUrl", "source_url"],
    ["officialWebsite", "official_website"],
    ["directBookingUrl", "direct_booking_url"],
  ];
  const urls: Partial<Record<string, string>> = {};
  for (const [key, column] of urlFields) {
    const value = raw[column];
    if (!isBlank(value)) {
      const parsed = parseHttpUrl((value as string).trim());
      if (parsed === null) {
        reject("invalid_url", `invalid URL in ${column}`, column);
      } else {
        urls[key] = parsed;
      }
    }
  }

  if (rejections.length > 0) {
    return { rejections };
  }

  const row: ParsedImportRow = {
    sourceKey,
    externalId,
    observedAt: observedAt.toISOString(),
    observationStatus: status as ObservationStatus,
    ...(isBlank(raw.title) ? {} : { title: (raw.title as string).trim() }),
    ...(isBlank(raw.region) ? {} : { region: (raw.region as string).trim() }),
    ...(latitude !== undefined ? { latitude, longitude } : {}),
    ...(rating !== undefined ? { rating } : {}),
    ...(reviewCount !== undefined ? { reviewCount } : {}),
    ...(isBlank(raw.observed_price_amount)
      ? {}
      : { observedPriceAmount: (raw.observed_price_amount as string).trim() }),
    ...(currency !== undefined ? { observedPriceCurrency: currency } : {}),
    ...(isBlank(raw.observed_price_unit)
      ? {}
      : { observedPriceUnit: (raw.observed_price_unit as string).trim() }),
    ...(isBlank(raw.bedrooms)
      ? {}
      : { bedrooms: parseDecimal(raw.bedrooms as string) ?? undefined }),
    ...(isBlank(raw.bathrooms)
      ? {}
      : { bathrooms: parseDecimal(raw.bathrooms as string) ?? undefined }),
    ...(isBlank(raw.guest_capacity)
      ? {}
      : {
          guestCapacity:
            parseInteger(raw.guest_capacity as string) ?? undefined,
        }),
    ...(isBlank(raw.is_superhost)
      ? {}
      : { isSuperhost: parseBoolean(raw.is_superhost as string) ?? undefined }),
    ...(isBlank(raw.host_external_id)
      ? {}
      : { hostExternalId: (raw.host_external_id as string).trim() }),
    ...(urls.sourceUrl ? { sourceUrl: urls.sourceUrl } : {}),
    ...(urls.officialWebsite ? { officialWebsite: urls.officialWebsite } : {}),
    ...(isBlank(raw.business_whatsapp)
      ? {}
      : { businessWhatsapp: (raw.business_whatsapp as string).trim() }),
    ...(urls.directBookingUrl
      ? { directBookingUrl: urls.directBookingUrl }
      : {}),
    ...(isBlank(raw.canonical_property_key)
      ? {}
      : {
          canonicalPropertyKey: (raw.canonical_property_key as string).trim(),
        }),
  };

  return { row, rejections: [] };
}
