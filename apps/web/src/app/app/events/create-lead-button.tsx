"use client";

import { useActionState } from "react";
import { Button } from "@bai/ui";
import { createLeadFromEventAction, type CreateLeadState } from "./actions";

interface CreateLeadButtonProps {
  eventId: string;
  propertyId: string;
  sourceListingId: string | null;
}

/** Convert an event to an organization-private lead (no outreach is performed). */
export function CreateLeadButton({
  eventId,
  propertyId,
  sourceListingId,
}: CreateLeadButtonProps) {
  const [state, formAction, pending] = useActionState<
    CreateLeadState,
    FormData
  >(createLeadFromEventAction, {});

  if (state.ok) {
    return (
      <span className="text-xs text-muted-foreground">
        {state.created ? "Lead created" : "Lead exists"}
      </span>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="propertyId" value={propertyId} />
      {sourceListingId ? (
        <input type="hidden" name="sourceListingId" value={sourceListingId} />
      ) : null}
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        Create lead
      </Button>
      {state.error ? (
        <span className="ml-2 text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}
