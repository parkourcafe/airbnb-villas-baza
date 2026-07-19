"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import { Button } from "@bai/ui";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

/**
 * A small client wrapper around a server action that surfaces validation/error
 * text and a pending state. Used for the org-private create forms (watchlists,
 * reports).
 */
export function ActionForm({
  action,
  submitLabel,
  children,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {},
  );
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {children}
      <Button type="submit" size="sm" disabled={pending}>
        {submitLabel}
      </Button>
      {state.error ? (
        <span className="w-full text-xs text-destructive">{state.error}</span>
      ) : null}
      {state.ok ? (
        <span className="w-full text-xs text-muted-foreground">Saved.</span>
      ) : null}
    </form>
  );
}
