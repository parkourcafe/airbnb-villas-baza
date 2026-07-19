"use client";

import { useActionState } from "react";
import { Button } from "@bai/ui";
import type { ActionState } from "../../_components/action-form";
import { mergePropertyAction } from "./actions";

export interface MergeCandidate {
  id: string;
  name: string;
}

/**
 * Admin-only control to merge THIS property into a canonical one. Snapshots and
 * source listings are preserved by the RPC; the duplicate is archived and a
 * redirect + audit entry is recorded.
 */
export function MergeControl({
  propertyId,
  candidates,
}: {
  propertyId: string;
  candidates: MergeCandidate[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    mergePropertyAction,
    {},
  );

  if (state.ok) {
    return (
      <p className="text-sm text-muted-foreground">
        Merged. This property is now archived; history is reachable on the
        canonical property.
      </p>
    );
  }

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No other property in this dataset to merge into.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="fromPropertyId" value={propertyId} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Merge into</span>
        <select
          name="toPropertyId"
          required
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Reason</span>
        <input
          name="reason"
          maxLength={200}
          className="h-9 w-64 rounded-md border border-input bg-background px-2 text-sm"
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Merge property
      </Button>
      {state.error ? (
        <span className="w-full text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}
