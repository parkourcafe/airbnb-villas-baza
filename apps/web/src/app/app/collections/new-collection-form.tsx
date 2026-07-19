"use client";

import { useActionState, useState } from "react";
import { Button } from "@bai/ui";
import { createCollectionAction } from "./actions";
import type { ActionState } from "../_components/action-form";

export interface AreaOption {
  key: string;
  name: string;
}

export interface SourceOption {
  id: string;
  displayName: string;
  complianceStatus: string;
}

const MODE_OPTIONS: { value: string; label: string; help: string }[] = [
  {
    value: "search_results_only",
    label: "Search results only",
    help: "Collect the listing cards from search results.",
  },
  {
    value: "search_and_details",
    label: "Search + listing details",
    help: "Also open each listing to capture details (slower).",
  },
  {
    value: "verify_existing_listings",
    label: "Verify existing listings",
    help: "Re-check listings from a previous snapshot.",
  },
];

const fieldClass =
  "h-9 rounded-md border border-input bg-background px-2 text-sm";

export function NewCollectionForm({
  areas,
  sources,
}: {
  areas: AreaOption[];
  sources: SourceOption[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createCollectionAction,
    {},
  );
  const [mode, setMode] = useState("search_results_only");
  const showAreas = mode !== "verify_existing_listings";
  const showDetails = mode === "search_and_details";

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Source</span>
          <select name="sourceId" className={fieldClass} required>
            {sources.length === 0 ? (
              <option value="">No source available</option>
            ) : (
              sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName} ({s.complianceStatus.replace(/_/g, " ")})
                </option>
              ))
            )}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Market</span>
          <select name="market" className={fieldClass} defaultValue="bali">
            <option value="bali">Bali</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Collection mode</span>
        <select
          name="mode"
          className={fieldClass}
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          {MODE_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          {MODE_OPTIONS.find((m) => m.value === mode)?.help}
        </span>
      </label>

      {showAreas ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Areas to search</legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {areas.map((area) => (
              <label key={area.key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="areas" value={area.key} />
                {area.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Minimum rating</span>
          <input
            name="minRating"
            type="number"
            step="0.01"
            min={0}
            max={5}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Minimum reviews</span>
          <input
            name="minReviewCount"
            type="number"
            min={0}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Maximum listings</span>
          <input
            name="maxListings"
            type="number"
            min={1}
            className={fieldClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Requested start time (optional)</span>
        <input
          name="requestedStartAt"
          type="datetime-local"
          className={`${fieldClass} w-64`}
        />
      </label>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="headed" defaultChecked />
          Visible (headed) browser — recommended
        </label>
        {showDetails ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="collectDetails" defaultChecked />
            Collect listing details
          </label>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || sources.length === 0}>
          {pending ? "Creating…" : "Create collection"}
        </Button>
        {state.error ? (
          <span className="text-sm text-destructive">{state.error}</span>
        ) : null}
      </div>
    </form>
  );
}
