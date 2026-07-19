import type { Metadata } from "next";
import { listReports, listWatchlists } from "@bai/db";
import { canMutateData } from "@bai/domain";
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
import { createReportAction } from "./actions";

export const metadata: Metadata = { title: "Reports" };

const REPORT_TYPES = ["watchlist_summary", "lifecycle_changes", "event_digest"];

export default async function ReportsPage() {
  const ctx = await loadTenancyContext();
  const org = ctx?.selectedOrganization ?? null;
  const dataset = ctx?.selectedDataset ?? null;
  const canCreate = org ? canMutateData(org.role) : false;

  if (!org || !dataset) {
    return (
      <div>
        <PageHeader title="Reports" />
        <EmptyState
          title="No organization selected"
          description="Select an organization and dataset to view reports."
        />
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const [reports, watchlists] = await Promise.all([
    listReports(supabase, org.id, dataset.id),
    listWatchlists(supabase, org.id, dataset.id),
  ]);

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Reproducible reports with immutable parameters. Generation and signed CSV download run as a worker job."
      />

      {canCreate ? (
        <div className="mb-6 rounded-lg border border-border p-4">
          <ActionForm action={createReportAction} submitLabel="Create report">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Name</span>
              <input
                name="name"
                required
                maxLength={120}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Type</span>
              <select
                name="reportType"
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {REPORT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Watchlist (optional)</span>
              <select
                name="watchlistId"
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">None</option>
                {watchlists.map((watchlist) => (
                  <option key={watchlist.id} value={watchlist.id}>
                    {watchlist.name}
                  </option>
                ))}
              </select>
            </label>
          </ActionForm>
        </div>
      ) : null}

      {reports.length === 0 ? (
        <EmptyState
          title="No reports yet"
          description={
            canCreate
              ? "Create a report definition above. Parameters are frozen once created so the output stays reproducible."
              : "Your role is read-only, so creating reports is disabled."
          }
        />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="font-medium">{report.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {report.reportType.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{report.status}</Badge>
                  </TableCell>
                  <TableCell>{formatDate(report.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
