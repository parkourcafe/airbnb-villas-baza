"use client";

import { useActionState } from "react";
import { Button } from "@bai/ui";
import type { ActionState } from "../../_components/action-form";
import { rollbackMergeAction, splitListingAction } from "./actions";

/** Split one source listing into its own property. */
export function SplitButton({ sourceListingId }: { sourceListingId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    splitListingAction,
    {},
  );
  if (state.ok) {
    return <span className="text-xs text-muted-foreground">Split off</span>;
  }
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="sourceListingId" value={sourceListingId} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        Split
      </Button>
      {state.error ? (
        <span className="ml-1 text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}

/** Roll back a prior merge that folded another property into this one. */
export function RollbackButton({ redirectId }: { redirectId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    rollbackMergeAction,
    {},
  );
  if (state.ok) {
    return <span className="text-xs text-muted-foreground">Rolled back</span>;
  }
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="redirectId" value={redirectId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Roll back
      </Button>
      {state.error ? (
        <span className="ml-2 text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}
