import type { Metadata } from "next";
import {
  listCollectionSchedules,
  listSourceCatalog,
  type SourceCatalogEntry,
} from "@bai/db";
import { canManageOrganization } from "@bai/domain";
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bai/ui";
import { loadTenancyContext } from "@/lib/tenancy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { PageHeader, EmptyState } from "../_components/page-parts";
import { ActionForm } from "../_components/action-form";
import { createScheduleAction } from "./actions";

export const metadata: Metadata = { title: "Sources" };

function complianceVariant(
  status: string,
): "secondary" | "outline" | "destructive" {
  if (status === "approved") return "secondary";
  if (status === "disabled") return "destructive";
  return "outline";
}

function automatable(source: SourceCatalogEntry): boolean {
  return source.complianceStatus === "approved" && source.automationAllowed;
}

export default async function SourcesPage() {
  const ctx = await loadTenancyContext();
  const org = ctx?.selectedOrganization ?? null;
  const dataset = ctx?.selectedDataset ?? null;
  const canManage = org ? canManageOrganization(org.role) : false;

  if (!org || !dataset) {
    return (
      <div>
        <PageHeader title="Sources" />
        <EmptyState
          title="No organization selected"
          description="Select an organization and dataset to view sources."
        />
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const [sources, schedules] = await Promise.all([
    listSourceCatalog(supabase),
    listCollectionSchedules(supabase, dataset.id),
  ]);
  const scheduleBySource = new Map(schedules.map((s) => [s.sourceId, s]));
  const automatable_sources = sources.filter(automatable);

  return (
    <div>
      <PageHeader
        title="Sources"
        description="Approved data sources, their compliance status and collection schedule. No live restricted collector runs."
      />

      <div className="mb-8 rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Compliance</TableHead>
              <TableHead>Automation</TableHead>
              <TableHead>Review expires</TableHead>
              <TableHead>Schedule</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((source) => {
              const schedule = scheduleBySource.get(source.id);
              return (
                <TableRow key={source.id}>
                  <TableCell className="font-medium">
                    {source.displayName}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {source.key}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {source.accessMode.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={complianceVariant(source.complianceStatus)}>
                      {source.complianceStatus.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {source.automationAllowed ? "Allowed" : "Manual only"}
                  </TableCell>
                  <TableCell>
                    {source.reviewExpiresAt
                      ? formatDate(source.reviewExpiresAt)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {schedule
                      ? `Every ${schedule.cadenceMinutes} min${schedule.enabled ? "" : " (off)"}`
                      : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {canManage ? (
        <div className="rounded-lg border border-border p-4">
          <p className="mb-3 text-sm font-medium">
            Schedule collection for this dataset
          </p>
          {automatable_sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No approved, automation-allowed source is available to schedule.
            </p>
          ) : (
            <ActionForm
              action={createScheduleAction}
              submitLabel="Add schedule"
            >
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Source</span>
                <select
                  name="sourceId"
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {automatable_sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Cadence (minutes)</span>
                <input
                  name="cadenceMinutes"
                  type="number"
                  min={1}
                  defaultValue={1440}
                  className="h-9 w-32 rounded-md border border-input bg-background px-2 text-sm"
                />
              </label>
            </ActionForm>
          )}
        </div>
      ) : null}
    </div>
  );
}
