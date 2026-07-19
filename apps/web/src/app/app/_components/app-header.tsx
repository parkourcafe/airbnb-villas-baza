import Link from "next/link";
import { Badge, Button } from "@bai/ui";
import type { TenancyContext } from "@/lib/tenancy";
import { signOutAction } from "@/lib/auth-actions";
import { OrgSwitcher } from "./org-switcher";
import { DatasetSwitcher } from "./dataset-switcher";

export function AppHeader({ ctx }: { ctx: TenancyContext }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/app/overview" className="font-semibold tracking-tight">
          BAI
        </Link>
        {ctx.selectedDataset?.isDemo ? (
          <Badge variant="warning">Demo data</Badge>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <OrgSwitcher
            organizations={ctx.organizations}
            selectedId={ctx.selectedOrganization?.id ?? null}
          />
          <DatasetSwitcher
            datasets={ctx.datasets}
            selectedId={ctx.selectedDataset?.id ?? null}
          />
          {ctx.userEmail ? (
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {ctx.userEmail}
            </span>
          ) : null}
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
