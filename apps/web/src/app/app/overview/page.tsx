import type { Metadata } from "next";
import Link from "next/link";
import { getDatasetOverview } from "@bai/db";
import type { DatasetOverview } from "@bai/domain";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@bai/ui";
import { loadTenancyContext } from "@/lib/tenancy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "../_components/page-parts";

export const metadata: Metadata = { title: "Overview" };

function kpis(overview: DatasetOverview | null) {
  return [
    { label: "Properties", value: overview?.properties },
    { label: "Active listings", value: overview?.activeListings },
    { label: "Suspected inactive", value: overview?.suspectedInactive },
    { label: "Likely inactive", value: overview?.confirmedInactive },
  ] as const;
}

export default async function OverviewPage() {
  const ctx = await loadTenancyContext();
  const dataset = ctx?.selectedDataset ?? null;

  let overview: DatasetOverview | null = null;
  if (dataset) {
    const supabase = await createSupabaseServerClient();
    overview = await getDatasetOverview(supabase, dataset.id);
  }

  const hasData = (overview?.properties ?? 0) > 0;

  return (
    <div>
      <PageHeader
        title="Overview"
        description={`Dataset: ${dataset?.name ?? "no dataset selected"}. Counts reflect the current seeded catalogue.`}
        actions={
          <Button asChild size="sm">
            <Link href="/app/properties">Browse properties</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis(overview).map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{kpi.value ?? "—"}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        {hasData
          ? `${overview?.events ?? 0} events recorded. "Likely inactive" is our observation label for confirmed inactivity — never a legal conclusion. Timestamps are stored in UTC and shown in Asia/Makassar.`
          : "No catalogue data yet for this dataset. Seed fixtures populate it in Milestone 2; imports follow in Milestone 3."}
      </p>
    </div>
  );
}
