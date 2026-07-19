import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bai/ui";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How BAI records observations and derives evidence-backed events without making legal conclusions.",
};

export default function MethodologyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Methodology</h1>
        <p className="text-muted-foreground">
          BAI observes accommodation listings over time and records what it saw,
          when, and from which source. Conclusions are expressed as
          observations, never as legal or causal claims.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Three-step inactivity confirmation</CardTitle>
          <CardDescription>
            A single missed observation is only a first miss. Inactivity is
            suspected on a second qualifying direct miss after at least 24
            hours, and confirmed on a third across at least seven days. Search
            absence and source errors never count as misses.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Reactivation resets the sequence and records its own event. Degraded
          collection runs suppress unsafe inactivity transitions entirely.
        </CardContent>
      </Card>
    </main>
  );
}
