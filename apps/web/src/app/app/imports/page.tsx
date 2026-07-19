import type { Metadata } from "next";
import Link from "next/link";
import { listImports } from "@bai/db";
import { canMutateData } from "@bai/domain";
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bai/ui";
import { loadTenancyContext } from "@/lib/tenancy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { PageHeader, EmptyState } from "../_components/page-parts";

export const metadata: Metadata = { title: "Imports" };

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "warning" | "destructive" | "outline"
> = {
  completed: "default",
  completed_with_errors: "warning",
  processing: "secondary",
  uploaded: "secondary",
  ready: "secondary",
  validating: "secondary",
  failed: "destructive",
  cancelled: "outline",
};

export default async function ImportsPage() {
  const ctx = await loadTenancyContext();
  const org = ctx?.selectedOrganization ?? null;
  const canImport = org ? canMutateData(org.role) : false;

  const supabase = await createSupabaseServerClient();
  const imports = org ? await listImports(supabase, org.id) : [];

  return (
    <div>
      <PageHeader
        title="Imports"
        description="Upload and track CSV snapshot imports."
        actions={
          <Button asChild size="sm" disabled={!canImport}>
            <Link href="/app/imports/new">New import</Link>
          </Button>
        }
      />

      {imports.length === 0 ? (
        <EmptyState
          title="No imports yet"
          description={
            canImport
              ? "Upload a CSV to import a snapshot. Processing runs asynchronously in the worker."
              : "Your role is read-only, so starting an import is disabled."
          }
        />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Accepted</TableHead>
                <TableHead className="text-right">Rejected</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {imports.map((imp) => (
                <TableRow key={imp.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/app/imports/${imp.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {imp.originalFilename ?? imp.id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[imp.status] ?? "outline"}>
                      {imp.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {imp.acceptedRows}
                  </TableCell>
                  <TableCell className="text-right">
                    {imp.rejectedRows}
                  </TableCell>
                  <TableCell>{formatDateTime(imp.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
