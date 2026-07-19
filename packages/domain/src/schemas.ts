import { z } from "zod";
import { OBSERVATION_STATUS, PRICE_UNIT, SOURCE_CAPABILITY } from "./enums";

/**
 * Zod schemas for untrusted boundaries. Only the schemas needed by the
 * foundation are defined here; import/snapshot schemas arrive in later
 * milestones alongside their engines.
 */

export const moneySchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/, "amount must be a decimal string"),
  currency: z.string().length(3).toUpperCase(),
  unit: z.enum(PRICE_UNIT),
});
export type MoneyInput = z.infer<typeof moneySchema>;

/**
 * A single raw observation as delivered by a source adapter, before
 * normalization. Mirrors the source adapter contract in
 * 02_SYSTEM_ARCHITECTURE section 7.
 */
export const rawObservationSchema = z.object({
  sourceKey: z.string().min(1),
  externalId: z.string().min(1),
  observedAt: z.string().datetime({ offset: true }),
  observationStatus: z.enum(OBSERVATION_STATUS),
  sourceUrl: z.string().url().optional(),
  payload: z.unknown(),
  evidence: z.object({
    method: z.string().min(1),
    requestId: z.string().optional(),
    objectPath: z.string().optional(),
    notes: z.string().optional(),
  }),
});
export type RawObservationInput = z.infer<typeof rawObservationSchema>;

export const sourceCapabilitySchema = z.enum(SOURCE_CAPABILITY);
