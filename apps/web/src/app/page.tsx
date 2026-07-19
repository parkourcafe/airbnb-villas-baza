import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bai/ui";

const PRINCIPLES = [
  {
    title: "Source-agnostic model",
    description:
      "Physical Property → Source Listing → Snapshot → Diff → Event. The core never assumes a single external site.",
  },
  {
    title: "Evidence-backed events",
    description:
      "Every event references the snapshots, run and rule version behind it. Search absence is never treated as removal.",
  },
  {
    title: "Observation language",
    description:
      "We report Not observed in search, Suspected inactive and Likely inactive. We never label a property illegal.",
  },
  {
    title: "Immutable history",
    description:
      "Snapshots are immutable. Corrections adjust projections without deleting the original observation.",
  },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-12 px-6 py-16">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Milestone 1 · Auth & tenancy</Badge>
            <Badge variant="warning">Demo data only</Badge>
            <Badge variant="outline">UTC stored · Asia/Makassar display</Badge>
          </div>
          <Button asChild size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Bali Accommodation Intelligence
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Source-agnostic, history-first, evidence-backed analytics for the Bali
          accommodation market. This repository is at its foundation milestone:
          the monorepo, tooling and design system are in place; data ingestion
          and dashboards arrive in later milestones.
        </p>
      </header>

      <section
        aria-labelledby="principles-heading"
        className="flex flex-col gap-6"
      >
        <h2 id="principles-heading" className="text-2xl font-semibold">
          Architectural principles
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {PRINCIPLES.map((principle) => (
            <Card key={principle.title}>
              <CardHeader>
                <CardTitle>{principle.title}</CardTitle>
                <CardDescription>{principle.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="status-heading">
        <Card>
          <CardHeader>
            <CardTitle id="status-heading">Compliance posture</CardTitle>
            <CardDescription>
              No live third-party collector is built or run. Data enters through
              CSV, demo fixtures, owner-provided data, licensed APIs or reviewed
              public data. The Airbnb source is seeded disabled and every
              automated adapter must pass the source compliance gate.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Learn more in the{" "}
            <a
              className="font-medium text-primary underline-offset-4 hover:underline"
              href="/methodology"
            >
              methodology overview
            </a>
            .
          </CardContent>
        </Card>
      </section>

      <footer className="mt-auto border-t border-border pt-6 text-sm text-muted-foreground">
        Timestamps are stored in UTC and displayed in Asia/Makassar. This is an
        internal foundation build; all sample data is clearly marked as demo.
      </footer>
    </main>
  );
}
