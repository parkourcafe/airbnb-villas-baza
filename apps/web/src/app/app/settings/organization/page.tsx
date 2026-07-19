import type { Metadata } from "next";
import { canManageOrganization } from "@bai/domain";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bai/ui";
import { loadTenancyContext } from "@/lib/tenancy";
import { PageHeader, EmptyState } from "../../_components/page-parts";

export const metadata: Metadata = { title: "Organization settings" };

export default async function OrganizationSettingsPage() {
  const ctx = await loadTenancyContext();
  const org = ctx?.selectedOrganization ?? null;

  if (!org) {
    return (
      <div>
        <PageHeader title="Organization" />
        <EmptyState
          title="No organization selected"
          description="You are not a member of any organization yet."
        />
      </div>
    );
  }

  const canManage = canManageOrganization(org.role);

  return (
    <div>
      <PageHeader
        title="Organization"
        description="Settings for the selected organization."
        actions={
          <Button
            size="sm"
            variant="outline"
            disabled={!canManage}
            title={
              canManage
                ? "Editing organization settings arrives in a later milestone"
                : "Your role cannot manage this organization"
            }
          >
            Edit
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{org.name}</CardTitle>
          <CardDescription>
            Your role: <Badge variant="secondary">{org.role}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Slug</dt>
              <dd className="font-medium">{org.slug}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Plan</dt>
              <dd className="font-medium">{org.planCode}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium">{org.status}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Default timezone</dt>
              <dd className="font-medium">{org.defaultTimezone}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
