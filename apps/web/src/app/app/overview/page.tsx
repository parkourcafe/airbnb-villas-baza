import type { Metadata } from "next";
import Link from "next/link";
import { Button, Card, CardHeader, CardTitle, CardContent } from "@bai/ui";
import { loadTenancyContext } from "@/lib/tenancy";
import { PageHeader } from "../_components/page-parts";

export const metadata: Metadata = { title: "Overview" };

const KPIS = [
  { label: "Properties" },
  { label: "Active listings" },
  { label: "Suspected inactive" },
  { label: "Likely inactive" },
] as const;

export default async function OverviewPage() {
  const ctx = await loadTenancyContext();
  const datasetName = ctx?.selectedDataset?.name ?? "no dataset selected";

  return (
    <div>
      <PageHeader
        title="Overview"
        description={`Dataset: ${datasetName}. Metrics appear once observations are imported.`}
        actions={
          <Button asChild size="sm">
            <Link href="/app/imports">Import data</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {KPIS.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold" aria-label="no data yet">
                —
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        No dataset history yet. Import a baseline snapshot to populate the
        overview. Timestamps are stored in UTC and shown in Asia/Makassar.
      </p>
    </div>
  );
}
