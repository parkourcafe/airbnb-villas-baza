import type { ServiceClient } from "../clients/service";

/** A manual review action an analyst can take on an event (04 §16). */
export type EventReviewAction = "reviewed" | "dismissed";

export interface ReviewEventParams {
  eventId: string;
  datasetId: string;
  action: EventReviewAction;
  actorId: string;
  organizationId: string;
  note?: string;
}

/**
 * Apply an analyst review action to an event and write an audit-log entry.
 *
 * Events are append-only to `authenticated` (RLS grants SELECT only), so this
 * runs with the service-role client. The caller MUST have already verified that
 * the actor can mutate the dataset; as defence in depth this also confirms the
 * event belongs to `datasetId` before mutating. A dismissed event is never
 * deleted — it stays in history with its reason (EVT-08), and the action is
 * always audited (04 §16, 5.6).
 */
export async function reviewEvent(
  client: ServiceClient,
  params: ReviewEventParams,
): Promise<void> {
  const { data: event, error: readError } = await client
    .from("events")
    .select("id, dataset_id")
    .eq("id", params.eventId)
    .maybeSingle();
  if (readError) throw readError;
  if (!event || event.dataset_id !== params.datasetId) {
    throw new Error("event not found in the target dataset");
  }

  const now = new Date().toISOString();
  const patch =
    params.action === "dismissed"
      ? { dismissed_at: now, dismissal_reason: params.note ?? null }
      : { is_reviewed: true, reviewed_by: params.actorId, reviewed_at: now };

  const { error: updateError } = await client
    .from("events")
    .update(patch)
    .eq("id", params.eventId);
  if (updateError) throw updateError;

  const { error: auditError } = await client.from("audit_logs").insert({
    organization_id: params.organizationId,
    actor_user_id: params.actorId,
    actor_type: "user",
    action: `event.${params.action}`,
    target_type: "event",
    target_id: params.eventId,
    metadata: params.note ? { note: params.note } : {},
  });
  if (auditError) throw auditError;
}
