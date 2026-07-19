import type { Money } from "@bai/domain";
import { isComparablePrice } from "@bai/domain";
import type { ChangeKind, FieldSpec } from "./fields";
import { SNAPSHOT_FIELDS } from "./fields";
import {
  DEFAULT_MATERIALITY,
  type MaterialityConfig,
  resolveMateriality,
} from "./materiality";
import { parseNumber } from "./normalize";
import type { BuiltSnapshot } from "./snapshot";

/** Absorbs binary floating-point error so threshold boundaries compare cleanly. */
const EPSILON = 1e-9;

/** The semantic nature of an observed change. */
export type DiffChangeKind =
  | "added"
  | "removed"
  | "increased"
  | "decreased"
  | "changed";

/**
 * A single field-level difference between two comparable snapshots. Mirrors the
 * `public.snapshot_diffs` row shape: `previousValue`/`currentValue` are the
 * jsonb-storable normalized values, and deltas are populated only for numeric
 * fields.
 */
export interface FieldDiff {
  fieldName: string;
  /** The field's comparison strategy (04 §6). */
  fieldKind: ChangeKind;
  /** What happened to the value. */
  changeKind: DiffChangeKind;
  previousValue: unknown;
  currentValue: unknown;
  absoluteDelta: number | null;
  percentDelta: number | null;
  isMaterial: boolean;
  ruleVersion: string;
}

export interface DiffOptions {
  materiality?: MaterialityConfig;
  /**
   * Whether the two snapshots were produced by compatible parsers. Defaults to
   * an exact `parserVersion` match. When the parsers are incompatible, all
   * field diffs are suppressed so a parser change never masquerades as a real
   * change (04 §11, test scenario 11).
   */
  parserCompatible?: boolean;
}

interface FieldValue {
  /** Comparable key: hash for content fields, primitive otherwise. */
  key: unknown;
  /** Value stored in the diff row (jsonb). */
  stored: unknown;
  /** Numeric value where the field is scalar-numeric, else null. */
  numeric: number | null;
  /** The raw money value where the field is money, else null. */
  money: Money | null;
}

/**
 * Compute the material and non-material field diffs going from `previous` to
 * `current`. A field is compared only when BOTH snapshots collected it
 * (field_presence, 04 §12/§9.6); incomparable prices (different currency/unit,
 * 04 §10.1) and parser-incompatible pairs (04 §11) are skipped entirely.
 * Deterministic: same inputs always yield the same diffs (idempotency, 04 §14).
 */
export function diffSnapshots(
  previous: BuiltSnapshot,
  current: BuiltSnapshot,
  options: DiffOptions = {},
): FieldDiff[] {
  const materiality = resolveMateriality(options.materiality ?? DEFAULT_MATERIALITY);
  const parserCompatible =
    options.parserCompatible ?? previous.parserVersion === current.parserVersion;
  if (!parserCompatible) return [];

  const diffs: FieldDiff[] = [];
  for (const spec of SNAPSHOT_FIELDS) {
    // Skip fields not collected on either side — cannot be compared.
    if (!previous.fieldPresence[spec.name] || !current.fieldPresence[spec.name]) {
      continue;
    }
    const diff = diffField(spec, previous, current, materiality);
    if (diff) diffs.push(diff);
  }
  return diffs;
}

function diffField(
  spec: FieldSpec,
  previous: BuiltSnapshot,
  current: BuiltSnapshot,
  materiality: MaterialityConfig,
): FieldDiff | null {
  const prev = fieldValue(spec, previous);
  const curr = fieldValue(spec, current);

  if (spec.kind === "money") {
    return diffMoney(spec, prev, curr, materiality);
  }

  const prevAbsent = prev.key === null || prev.key === undefined;
  const currAbsent = curr.key === null || curr.key === undefined;
  if (prevAbsent && currAbsent) return null;

  if (spec.kind === "scalar_number") {
    return diffNumber(spec, prev, curr, materiality);
  }

  // hash / set / boolean / location / scalar_text: equality on the comparable key.
  if (equalKeys(prev.key, curr.key)) return null;

  const changeKind: DiffChangeKind = prevAbsent
    ? "added"
    : currAbsent
      ? "removed"
      : "changed";

  return {
    fieldName: spec.name,
    fieldKind: spec.kind,
    changeKind,
    previousValue: prev.stored,
    currentValue: curr.stored,
    absoluteDelta: null,
    percentDelta: null,
    isMaterial: isNonNumericMaterial(spec, materiality),
    ruleVersion: materiality.version,
  };
}

function diffNumber(
  spec: FieldSpec,
  prev: FieldValue,
  curr: FieldValue,
  materiality: MaterialityConfig,
): FieldDiff | null {
  const prevNum = prev.numeric;
  const currNum = curr.numeric;
  if (prevNum === null && currNum === null) return null;

  if (prevNum === null || currNum === null) {
    return {
      fieldName: spec.name,
      fieldKind: spec.kind,
      changeKind: prevNum === null ? "added" : "removed",
      previousValue: prev.stored,
      currentValue: curr.stored,
      absoluteDelta: null,
      percentDelta: null,
      isMaterial: isNonNumericMaterial(spec, materiality),
      ruleVersion: materiality.version,
    };
  }

  if (prevNum === currNum) return null;

  const absoluteDelta = currNum - prevNum;
  const percentDelta = prevNum === 0 ? null : absoluteDelta / prevNum;
  return {
    fieldName: spec.name,
    fieldKind: spec.kind,
    changeKind: absoluteDelta > 0 ? "increased" : "decreased",
    previousValue: prev.stored,
    currentValue: curr.stored,
    absoluteDelta,
    percentDelta,
    isMaterial: isNumberMaterial(spec.name, absoluteDelta, materiality),
    ruleVersion: materiality.version,
  };
}

function diffMoney(
  spec: FieldSpec,
  prev: FieldValue,
  curr: FieldValue,
  materiality: MaterialityConfig,
): FieldDiff | null {
  const prevMoney = prev.money;
  const currMoney = curr.money;
  if (!prevMoney && !currMoney) return null;

  if (!prevMoney || !currMoney) {
    return {
      fieldName: spec.name,
      fieldKind: spec.kind,
      changeKind: !prevMoney ? "added" : "removed",
      previousValue: prev.stored,
      currentValue: curr.stored,
      absoluteDelta: null,
      percentDelta: null,
      isMaterial: true, // gaining/losing a price is always notable
      ruleVersion: materiality.version,
    };
  }

  // Incomparable prices (different currency/unit) are never diffed (04 §10.1).
  if (!isComparablePrice(prevMoney, currMoney)) return null;

  const prevAmount = parseNumber(prevMoney.amount);
  const currAmount = parseNumber(currMoney.amount);
  if (prevAmount === null || currAmount === null) return null;
  if (prevAmount === currAmount) return null;

  const absoluteDelta = currAmount - prevAmount;
  const percentDelta = prevAmount === 0 ? null : absoluteDelta / prevAmount;
  const material =
    (percentDelta !== null &&
      Math.abs(percentDelta) + EPSILON >= materiality.pricePercentThreshold) ||
    (materiality.priceAbsoluteThreshold !== undefined &&
      Math.abs(absoluteDelta) + EPSILON >= materiality.priceAbsoluteThreshold);

  return {
    fieldName: spec.name,
    fieldKind: spec.kind,
    changeKind: absoluteDelta > 0 ? "increased" : "decreased",
    previousValue: prev.stored,
    currentValue: curr.stored,
    absoluteDelta,
    percentDelta,
    isMaterial: material,
    ruleVersion: materiality.version,
  };
}

function isNumberMaterial(
  fieldName: string,
  absoluteDelta: number,
  materiality: MaterialityConfig,
): boolean {
  const magnitude = Math.abs(absoluteDelta);
  switch (fieldName) {
    case "rating":
      return magnitude + EPSILON >= materiality.ratingThreshold;
    case "review_count":
      // Only increases raise a visible event; decreases are a data-quality
      // concern, stored but not material (04 §10.3).
      return absoluteDelta + EPSILON >= materiality.reviewCountThreshold;
    default:
      // bedrooms/bathrooms/guest_capacity: any change is material.
      return true;
  }
}

function isNonNumericMaterial(
  spec: FieldSpec,
  _materiality: MaterialityConfig,
): boolean {
  // Content/identity changes are material by default; the event layer (M5) may
  // still choose whether to surface them.
  switch (spec.kind) {
    case "hash":
    case "set":
    case "boolean":
    case "location":
    case "scalar_text":
      return true;
    default:
      return false;
  }
}

function equalKeys(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
}

function fieldValue(spec: FieldSpec, snap: BuiltSnapshot): FieldValue {
  const empty: FieldValue = {
    key: null,
    stored: null,
    numeric: null,
    money: null,
  };
  switch (spec.name) {
    case "title":
      return keyValue(snap.titleHash);
    case "description":
      return keyValue(snap.descriptionHash);
    case "photos":
      return keyValue(snap.photosHash);
    case "amenities":
      return {
        key: snap.amenitiesHash,
        stored: snap.amenities,
        numeric: null,
        money: null,
      };
    case "property_type":
      return keyValue(snap.propertyType);
    case "location":
      return {
        key:
          snap.latitude === null || snap.longitude === null
            ? null
            : `${snap.latitude},${snap.longitude}`,
        stored:
          snap.latitude === null || snap.longitude === null
            ? null
            : { latitude: snap.latitude, longitude: snap.longitude },
        numeric: null,
        money: null,
      };
    case "rating":
      return numberValue(snap.rating);
    case "review_count":
      return numberValue(snap.reviewCount);
    case "price":
      return {
        key: snap.price
          ? `${snap.price.amount}|${snap.price.currency}|${snap.price.unit}`
          : null,
        stored: snap.price,
        numeric: null,
        money: snap.price,
      };
    case "bedrooms":
      return numberValue(snap.bedrooms);
    case "bathrooms":
      return numberValue(snap.bathrooms);
    case "guest_capacity":
      return numberValue(snap.guestCapacity);
    case "is_superhost":
      return {
        key: snap.isSuperhost,
        stored: snap.isSuperhost,
        numeric: null,
        money: null,
      };
    case "host_external_id":
      return keyValue(snap.hostExternalId);
    case "official_website":
      return keyValue(snap.officialWebsite);
    case "business_whatsapp":
      return keyValue(snap.businessWhatsapp);
    case "direct_booking_url":
      return keyValue(snap.directBookingUrl);
    default:
      return empty;
  }
}

function keyValue(value: string | null): FieldValue {
  return { key: value, stored: value, numeric: null, money: null };
}

function numberValue(value: number | null): FieldValue {
  return { key: value, stored: value, numeric: value, money: null };
}
