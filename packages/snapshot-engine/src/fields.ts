/**
 * The canonical set of comparable snapshot fields and how each is diffed.
 * This registry is the single source of truth shared by field-presence
 * computation (04 §12) and the diff engine (04 §6/§10), so the two can never
 * drift out of sync.
 */

/** How a field's previous/current values are compared. */
export type ChangeKind =
  | "scalar_number"
  | "scalar_text"
  | "money"
  | "boolean"
  | "hash"
  | "set"
  | "location";

export interface FieldSpec {
  /** Stable logical field name, also the `field_presence` / diff key. */
  name: string;
  kind: ChangeKind;
}

export const SNAPSHOT_FIELDS: readonly FieldSpec[] = [
  { name: "title", kind: "hash" },
  { name: "description", kind: "hash" },
  { name: "photos", kind: "hash" },
  { name: "amenities", kind: "set" },
  { name: "property_type", kind: "scalar_text" },
  { name: "location", kind: "location" },
  { name: "rating", kind: "scalar_number" },
  { name: "review_count", kind: "scalar_number" },
  { name: "price", kind: "money" },
  { name: "bedrooms", kind: "scalar_number" },
  { name: "bathrooms", kind: "scalar_number" },
  { name: "guest_capacity", kind: "scalar_number" },
  { name: "is_superhost", kind: "boolean" },
  { name: "host_external_id", kind: "scalar_text" },
  { name: "official_website", kind: "scalar_text" },
  { name: "business_whatsapp", kind: "scalar_text" },
  { name: "direct_booking_url", kind: "scalar_text" },
] as const;

export const SNAPSHOT_FIELD_NAMES: readonly string[] = SNAPSHOT_FIELDS.map(
  (f) => f.name,
);

const FIELD_BY_NAME = new Map<string, FieldSpec>(
  SNAPSHOT_FIELDS.map((f) => [f.name, f]),
);

export function fieldSpec(name: string): FieldSpec | undefined {
  return FIELD_BY_NAME.get(name);
}
