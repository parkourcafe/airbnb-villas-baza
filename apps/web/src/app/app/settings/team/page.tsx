import type { Metadata } from "next";
import { canManageMembers } from "@bai/domain";
import { listOrganizationMembers } from "@bai/db";
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
import { PageHeader, EmptyState } from "../../_components/page-parts";

export const metadata: Metadata = { title: "Team" };

export default async function TeamSettingsPage() {
  const ctx = await loadTenancyContext();
  const org = ctx?.selectedOrganization ?? null;

  if (!org) {
    return (
      <div>
        <PageHeader title="Team" />
        <EmptyState
          title="No organization selected"
          description="You are not a member of any organization yet."
        />
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const members = await listOrganizationMembers(supabase, org.id);
  const canManage = canManageMembers(org.role);

  return (
    <div>
      <PageHeader
        title="Team"
        description={`Members of ${org.name}.`}
        actions={
          <Button
            size="sm"
            disabled={!canManage}
            title={
              canManage
                ? "Inviting members arrives in a later milestone"
                : "Your role cannot manage members"
            }
          >
            Invite member
          </Button>
        }
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const isSelf = member.userId === ctx?.userId;
            return (
              <TableRow key={member.userId}>
                <TableCell className="font-mono text-xs">
                  {member.userId.slice(0, 8)}…
                  {isSelf ? (
                    <Badge variant="outline" className="ml-2">
                      you
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{member.role}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
