"use server";

import { revalidatePath } from "next/cache";
import {
  createLead,
  getServiceClient,
  reviewEvent,
  type EventReviewAction,
} from "@bai/db";
import { canMutateData } from "@bai/domain";
import { loadTenancyContext } from "@/lib/tenancy";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ReviewEventState {
  ok?: boolean;
  error?: string;
}

/**
 * Server action for an analyst review action on an event. Authorization is
 * enforced here in app code from the membership/access tables (never from user
 * metadata): the caller must be able to mutate the currently-selected dataset.
 * The mutation itself runs with the service-role client because events are
 * append-only to `authenticated`, and every action is audited.
 */
export async function reviewEventAction(
  _prev: ReviewEventState,
  formData: FormData,
): Promise<ReviewEventState> {
  const eventId = String(formData.get("eventId") ?? "");
  const action = String(formData.get("action") ?? "") as EventReviewAction;
  const note = String(formData.get("note") ?? "").trim();
  if (!eventId || (action !== "reviewed" && action !== "dismissed")) {
    return { error: "Invalid review request." };
  }

  const ctx = await loadTenancyContext();
  const org = ctx?.selectedOrganization ?? null;
  const dataset = ctx?.selectedDataset ?? null;
  if (!ctx || !org || !dataset) {
    return { error: "No organization or dataset selected." };
  }
  if (!canMutateData(org.role)) {
    return { error: "Your role cannot review events." };
  }

  try {
    await reviewEvent(getServiceClient(), {
      eventId,
      datasetId: dataset.id,
      action,
      actorId: ctx.userId,
      organizationId: org.id,
      note: note || undefined,
    });
  } catch {
    return { error: "Could not apply the review action." };
  }

  revalidatePath("/app/events");
  return { ok: true };
}

export interface CreateLeadState {
  ok?: boolean;
  error?: string;
  created?: boolean;
}

/**
 * Convert an event to a lead, preserving the evidence link (event_id). Leads are
 * organization-private and capture intent only — there is no outreach/send. The
 * insert is idempotent per organization+property.
 */
export async function createLeadFromEventAction(
  _prev: CreateLeadState,
  formData: FormData,
): Promise<CreateLeadState> {
  const propertyId = String(formData.get("propertyId") ?? "");
  const eventId = String(formData.get("eventId") ?? "") || undefined;
  const sourceListingId = String(formData.get("sourceListingId") ?? "") || undefined;
  if (!propertyId) return { error: "Missing property." };

  const ctx = await loadTenancyContext();
  const org = ctx?.selectedOrganization ?? null;
  const dataset = ctx?.selectedDataset ?? null;
  if (!ctx || !org || !dataset) {
    return { error: "No organization or dataset selected." };
  }
  if (!canMutateData(org.role)) {
    return { error: "Your role cannot create leads." };
  }

  const supabase = await createSupabaseServerClient();
  try {
    const { created } = await createLead(supabase, {
      organizationId: org.id,
      datasetId: dataset.id,
      propertyId,
      sourceListingId,
      eventId,
      reasonCode: "event_conversion",
      reasonText: "Converted from an observed event.",
    });
    revalidatePath("/app/leads");
    return { ok: true, created };
  } catch {
    return { error: "Could not create the lead." };
  }
}
