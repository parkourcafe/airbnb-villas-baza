import type { Metadata } from "next";
import Link from "next/link";
import { listLeads } from "@bai/db";
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

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage() {
  const ctx = await loadTenancyContext();
  const org = ctx?.selectedOrganization ?? null;

  if (!org) {
    return (
      <div>
        <PageHeader title="Leads" />
        <EmptyState
          title="No organization selected"
          description="Select an organization to view leads."
        />
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const leads = await listLeads(supabase, org.id);

  return (
    <div>
      <PageHeader
        title="Leads"
        description={`Outreach intent captured from observed events — private to ${org.name}. No messages are sent from BAI.`}
      />

      {leads.length === 0 ? (
        <EmptyState
          title="No leads yet"
          description="Convert an event to a lead from the Events page. Leads keep a link to the evidence that created them."
        />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Evidence</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <Link
                      href={`/app/properties/${lead.propertyId}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      View property
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{lead.stage}</Badge>
                    {lead.doNotContact ? (
                      <Badge variant="outline" className="ml-2">
                        Do not contact
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.reasonText ?? lead.reasonCode ?? "—"}
                  </TableCell>
                  <TableCell>
                    {lead.eventId ? (
                      <Badge variant="outline">Linked event</Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{formatDate(lead.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
