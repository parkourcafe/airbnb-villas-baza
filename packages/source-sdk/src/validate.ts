import { ValidationError, type SourceCapability } from "@bai/domain";
import type { SourceAdapterDefinition } from "./types";

/**
 * Assert every requested capability is declared by the source definition. This
 * is the SDK-side counterpart to the compliance gate's capability check (8.1):
 * an adapter may never be asked to exercise a capability it does not advertise.
 */
export function validateCapabilities(
  definition: SourceAdapterDefinition,
  requested: readonly SourceCapability[],
): void {
  const declared = new Set(definition.capabilities);
  const missing = requested.filter((c) => !declared.has(c));
  if (missing.length > 0) {
    throw new ValidationError(
      `source "${definition.key}" cannot use capabilities: ${missing.join(", ")}`,
    );
  }
}

/**
 * Validate an adapter configuration against a set of required keys and an
 * optional per-key predicate. Adapters call this from `validateConfiguration`
 * so a misconfigured run fails fast, before any collection work begins.
 */
export function validateRequiredConfig(
  config: Record<string, unknown>,
  required: readonly string[],
  predicates: Record<string, (value: unknown) => boolean> = {},
): void {
  for (const key of required) {
    if (config[key] === undefined || config[key] === null) {
      throw new ValidationError(`missing required configuration "${key}"`);
    }
  }
  for (const [key, predicate] of Object.entries(predicates)) {
    if (config[key] !== undefined && !predicate(config[key])) {
      throw new ValidationError(`invalid configuration value for "${key}"`);
    }
  }
}
