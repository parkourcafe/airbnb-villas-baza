/**
 * Open-redirect protection (SEC-07). A post-login redirect target must be an
 * internal, same-origin path. Anything else - absolute URLs, protocol-relative
 * `//host`, backslash tricks, non-path values - falls back to a safe default.
 */
export function sanitizeInternalPath(
  value: string | null | undefined,
  fallback = "/app/overview",
): string {
  if (typeof value !== "string" || value.length === 0) {
    return fallback;
  }
  // Must be a root-relative path.
  if (!value.startsWith("/")) {
    return fallback;
  }
  // Reject protocol-relative ("//evil.com") and backslash-normalized variants.
  if (
    value.startsWith("//") ||
    value.startsWith("/\\") ||
    value.includes("\\")
  ) {
    return fallback;
  }
  // Reject control characters (charCode <= 31), which could smuggle newlines.
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) <= 0x1f) {
      return fallback;
    }
  }
  // Reject anything that smuggles a scheme like "/javascript:...".
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) {
    return fallback;
  }
  return value;
}
