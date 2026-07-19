import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { loadTenancyContext } from "@/lib/tenancy";
import { AppHeader } from "./_components/app-header";
import { AppNav } from "./_components/app-nav";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await loadTenancyContext();
  if (!ctx) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader ctx={ctx} />
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row">
        <aside className="md:w-56 md:shrink-0">
          <AppNav />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
