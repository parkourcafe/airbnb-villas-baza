/**
 * Row rejection reason codes. One invalid row is rejected with a reason; it must
 * never fail the whole import unless a configured threshold is exceeded (handled
 * by the caller). See 06_ACCEPTANCE_TESTS IMP-02.
 */
export const REJECTION_CODE = [
  "missing_external_id",
  "invalid_timestamp",
  "invalid_status",
  "rating_out_of_range",
  "negative_review_count",
  "invalid_coordinates",
  "coordinates_outside_coverage",
  "unknown_currency",
  "invalid_url",
  "unknown_source",
  "source_not_approved",
  "duplicate_conflict",
] as const;
export type RejectionCode = (typeof REJECTION_CODE)[number];

export interface RowRejection {
  /** 1-based data row number (excludes the header row). */
  rowNumber: number;
  code: RejectionCode;
  message: string;
  column?: string;
}
