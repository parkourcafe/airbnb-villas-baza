"use client";

import type { EventEvidenceItem } from "@bai/domain";
import {
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@bai/ui";

/**
 * Evidence drawer. Every event is evidence-backed; this shows the supporting
 * snapshots/run behind an observation. Evidence is passed in from the server
 * (no client fetching).
 */
export function EvidenceSheet({
  eventTitle,
  evidence,
}: {
  eventTitle: string;
  evidence: EventEvidenceItem[];
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" disabled={evidence.length === 0}>
          {evidence.length > 0
            ? `Evidence (${evidence.length})`
            : "No evidence"}
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Evidence</SheetTitle>
          <SheetDescription>{eventTitle}</SheetDescription>
        </SheetHeader>
        <ul className="mt-6 flex flex-col gap-4">
          {evidence.map((item) => (
            <li
              key={item.id}
              className="rounded-md border border-border p-3 text-sm"
            >
              <Badge variant="secondary">{item.evidenceType}</Badge>
              <p className="mt-2 text-muted-foreground">{item.explanation}</p>
              <dl className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                {item.currentSnapshotId ? (
                  <div className="col-span-2">
                    <dt className="inline font-medium">Current snapshot: </dt>
                    <dd className="inline font-mono">
                      {item.currentSnapshotId.slice(0, 8)}…
                    </dd>
                  </div>
                ) : null}
                {item.previousSnapshotId ? (
                  <div className="col-span-2">
                    <dt className="inline font-medium">Previous snapshot: </dt>
                    <dd className="inline font-mono">
                      {item.previousSnapshotId.slice(0, 8)}…
                    </dd>
                  </div>
                ) : null}
                {item.collectionRunId ? (
                  <div className="col-span-2">
                    <dt className="inline font-medium">Run: </dt>
                    <dd className="inline font-mono">
                      {item.collectionRunId.slice(0, 8)}…
                    </dd>
                  </div>
                ) : null}
              </dl>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
