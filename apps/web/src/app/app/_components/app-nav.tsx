"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@bai/ui";

const NAV = [
  { href: "/app/overview", label: "Overview" },
  { href: "/app/properties", label: "Properties" },
  { href: "/app/map", label: "Map" },
  { href: "/app/events", label: "Events" },
  { href: "/app/imports", label: "Imports" },
  { href: "/app/watchlists", label: "Watchlists" },
  { href: "/app/leads", label: "Leads" },
  { href: "/app/reports", label: "Reports" },
  { href: "/app/settings/organization", label: "Organization" },
  { href: "/app/settings/team", label: "Team" },
] as const;

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="flex gap-1 overflow-x-auto md:flex-col"
    >
      {NAV.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
