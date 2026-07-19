import { ComplianceError } from "@bai/domain";
import type { SourceAdapterDefinition } from "./types";
import type { SourceCapability } from "@bai/domain";

export interface ComplianceGateOptions {
  /** True when the run is triggered automatically (worker/cron) rather than by a manual, reviewed action. */
  automated?: boolean;
  /** Capabilities the run intends to exercise. */
  requestedCapabilities?: SourceCapability[];
  /** Current time; injected so the gate is deterministic and testable. */
  now?: Date;
}

/**
 * The compliance gate. The worker MUST call this before invoking `collect` on
 * any adapter. It throws a non-retryable {@link ComplianceError} when a source
 * is not permitted to run, which is what keeps a disabled or pending source from
 * ever reaching the network - even if a job row is inserted by hand.
 *
 * Rules (02_SYSTEM_ARCHITECTURE section 7 "Required gate"):
 * - compliance status must be `approved`;
 * - automated runs require `automationAllowed`;
 * - a source review must not be expired;
 * - every requested capability must be declared by the source.
 */
export function assertSourceExecutionAllowed(
  definition: SourceAdapterDefinition,
  options: ComplianceGateOptions = {},
): void {
  const {
    automated = true,
    requestedCapabilities = [],
    now = new Date(),
  } = options;

  if (definition.complianceStatus !== "approved") {
    throw new ComplianceError(
      `source "${definition.key}" is not approved (status: ${definition.complianceStatus})`,
    );
  }

  if (automated && !definition.automationAllowed) {
    throw new ComplianceError(
      `source "${definition.key}" does not permit automated execution`,
    );
  }

  if (definition.reviewExpiresAt) {
    const expiry = new Date(definition.reviewExpiresAt);
    if (Number.isNaN(expiry.getTime())) {
      throw new ComplianceError(
        `source "${definition.key}" has an invalid review expiry`,
      );
    }
    if (expiry.getTime() < now.getTime()) {
      throw new ComplianceError(
        `source "${definition.key}" compliance review expired at ${definition.reviewExpiresAt}`,
      );
    }
  }

  const declared = new Set(definition.capabilities);
  for (const capability of requestedCapabilities) {
    if (!declared.has(capability)) {
      throw new ComplianceError(
        `source "${definition.key}" is not permitted to use capability "${capability}"`,
      );
    }
  }
}

/** Non-throwing convenience wrapper. */
export function isSourceExecutionAllowed(
  definition: SourceAdapterDefinition,
  options: ComplianceGateOptions = {},
): boolean {
  try {
    assertSourceExecutionAllowed(definition, options);
    return true;
  } catch {
    return false;
  }
}
