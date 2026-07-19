"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";
import type { OrganizationWithRole } from "@bai/domain";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@bai/ui";
import { selectOrganization } from "@/lib/selection-actions";

export function OrgSwitcher({
  organizations,
  selectedId,
}: {
  organizations: OrganizationWithRole[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const selected = organizations.find((o) => o.id === selectedId) ?? null;

  if (organizations.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">No organization</span>
    );
  }

  function choose(id: string) {
    startTransition(async () => {
      await selectOrganization(id);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          {selected?.name ?? "Select organization"}
          <ChevronsUpDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>Organization</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => choose(org.id)}
            className="justify-between"
          >
            <span>{org.name}</span>
            {org.id === selectedId ? <Check className="h-4 w-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
