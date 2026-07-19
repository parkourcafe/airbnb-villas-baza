/**
 * Business error hierarchy for the BAI domain. These are transport-agnostic:
 * they carry a stable machine-readable `code` that adapters, the worker and the
 * web layer can map to their own responses.
 */
export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

/** Raised when untrusted input fails validation at a boundary. */
export class ValidationError extends DomainError {
  constructor(message: string) {
    super("validation_error", message);
  }
}

/**
 * Raised by the source compliance gate when a source is not permitted to run.
 * This error is non-retryable: a job that hits it must fail permanently.
 */
export class ComplianceError extends DomainError {
  constructor(message: string) {
    super("compliance_error", message);
  }
}

/** Convenience guard used across engines. */
export function isDomainError(value: unknown): value is DomainError {
  return value instanceof DomainError;
}
