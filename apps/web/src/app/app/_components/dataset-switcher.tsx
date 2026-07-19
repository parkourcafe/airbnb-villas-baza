"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";
import type { DatasetWithAccess } from "@bai/domain";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@bai/ui";
import { selectDataset } from "@/lib/selection-actions";

export function DatasetSwitcher({
  datasets,
  selectedId,
}: {
  datasets: DatasetWithAccess[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const selected = datasets.find((d) => d.id === selectedId) ?? null;

  if (datasets.length === 0) {
    return <span className="text-sm text-muted-foreground">No dataset</span>;
  }

  function choose(id: string) {
    startTransition(async () => {
      await selectDataset(id);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          {selected?.name ?? "Select dataset"}
          <ChevronsUpDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>Dataset</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {datasets.map((dataset) => (
          <DropdownMenuItem
            key={dataset.id}
            onSelect={() => choose(dataset.id)}
            className="justify-between"
          >
            <span>{dataset.name}</span>
            {dataset.id === selectedId ? <Check className="h-4 w-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
