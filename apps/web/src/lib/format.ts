const DISPLAY_TIME_ZONE = "Asia/Makassar";

/** Format an ISO timestamp as a date in the display timezone (Asia/Makassar). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(new Date(iso));
}

/** Format an ISO timestamp as a date + time in the display timezone. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(new Date(iso));
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-GB").format(value);
}
