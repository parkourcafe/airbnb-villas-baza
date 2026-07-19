import { Badge, type BadgeProps } from "@bai/ui";

/**
 * Lifecycle status shown in observation language. `confirmed_inactive` is
 * surfaced as "Likely inactive" - never a definitive or legal claim.
 */
const LABELS: Record<string, string> = {
  active: "Active",
  first_miss: "First miss",
  suspected_inactive: "Suspected inactive",
  confirmed_inactive: "Likely inactive",
  reactivated: "Reactivated",
  archived: "Archived",
};

const VARIANTS: Record<string, BadgeProps["variant"]> = {
  active: "default",
  first_miss: "secondary",
  suspected_inactive: "warning",
  confirmed_inactive: "destructive",
  reactivated: "default",
  archived: "outline",
};

export function LifecycleBadge({ status }: { status: string | null }) {
  if (!status) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <Badge variant={VARIANTS[status] ?? "outline"}>
      {LABELS[status] ?? status}
    </Badge>
  );
}
