"use client";

import { useActionState } from "react";
import { Badge, Button } from "@bai/ui";
import { reviewEventAction, type ReviewEventState } from "./actions";

interface EventReviewProps {
  eventId: string;
  isReviewed: boolean;
  isDismissed: boolean;
  canReview: boolean;
}

/**
 * Inline review controls for one event. Analysts can mark an event reviewed or
 * dismiss it; a dismissed event stays in history (EVT-08). Read-only roles see
 * the status badge only.
 */
export function EventReview({
  eventId,
  isReviewed,
  isDismissed,
  canReview,
}: EventReviewProps) {
  const [state, formAction, pending] = useActionState<
    ReviewEventState,
    FormData
  >(reviewEventAction, {});

  const status = isDismissed ? (
    <Badge variant="outline">Dismissed</Badge>
  ) : isReviewed ? (
    <Badge variant="secondary">Reviewed</Badge>
  ) : (
    <Badge variant="outline">Pending</Badge>
  );

  if (!canReview || isDismissed) {
    return <div className="flex justify-end">{status}</div>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {status}
      <div className="flex gap-2">
        {!isReviewed ? (
          <form action={formAction}>
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="action" value="reviewed" />
            <Button type="submit" size="sm" variant="ghost" disabled={pending}>
              Mark reviewed
            </Button>
          </form>
        ) : null}
        <form action={formAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="action" value="dismissed" />
          <Button type="submit" size="sm" variant="ghost" disabled={pending}>
            Dismiss
          </Button>
        </form>
      </div>
      {state.error ? (
        <span className="text-xs text-destructive">{state.error}</span>
      ) : null}
    </div>
  );
}
