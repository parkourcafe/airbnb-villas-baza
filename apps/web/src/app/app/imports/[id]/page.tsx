import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getImport, getImportRejections } from "@bai/db";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { PageHeader } from "../../_components/page-parts";

export const metadata: Metadata = { title: "Import" };

export default async function ImportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await loadTenancyContext();
  const supabase = await createSupabaseServerClient();

  const imp = await getImport(supabase, id);
  if (!imp) {
    notFound();
  }

  const rejections =
    imp.rejectedRows > 0 ? await getImportRejections(supabase, id) : [];

  const metrics = [
    { label: "Total rows", value: imp.totalRows },
    { label: "Accepted", value: imp.acceptedRows },
    { label: "Rejected", value: imp.rejectedRows },
    { label: "Duplicates", value: imp.duplicateRows },
  ];

  return (
    <div>
      <PageHeader
        title={imp.originalFilename ?? "Import"}
        description={`Started ${formatDateTime(imp.createdAt)}`}
        actions={
          <Badge variant="outline">{imp.status.replace(/_/g, " ")}</Badge>
        }
      />
      <Link
        href="/app/imports"
        className="mb-4 inline-block text-sm text-muted-foreground hover:underline"
      >
        ← Back to imports
      </Link>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {m.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {rejections.length > 0 ? (
        <section aria-labelledby="rejections-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="rejections-heading" className="text-lg font-semibold">
              Rejected rows
            </h2>
            <Button asChild size="sm" variant="outline">
              <a href={`/api/imports/${imp.id}/rejections`} download>
                Download CSV
              </a>
            </Button>
          </div>
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">Row</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rejections.map((r) => (
                  <TableRow key={`${r.rowNumber}-${r.errorCode}`}>
                    <TableCell className="text-right font-mono text-xs">
                      {r.rowNumber}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">{r.errorCode}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.errorMessage ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
