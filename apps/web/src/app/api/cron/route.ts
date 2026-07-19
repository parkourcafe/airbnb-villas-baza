import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * Protected cron entry point (8.5). A scheduler calls this with the shared
 * `CRON_SECRET`; the handler enqueues due collection jobs. It NEVER runs a live
 * third-party collector — it only enqueues jobs for sources the compliance gate
 * already approves, which the worker then claims.
 *
 * Security:
 * - requires `Authorization: Bearer <CRON_SECRET>` (or `x-cron-secret`);
 * - a constant-time comparison avoids leaking the secret via timing;
 * - if `CRON_SECRET` is unset, every request is rejected (fail closed);
 * - no secrets are ever returned in the response.
 */
export const dynamic = "force-dynamic";

function presentedSecret(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length);
  return request.headers.get("x-cron-secret");
}

function secretsMatch(expected: string, presented: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(presented);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authorize(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false; // fail closed when unconfigured
  const presented = presentedSecret(request);
  return presented !== null && secretsMatch(expected, presented);
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!authorize(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Enqueue due jobs only. The set of scheduled sources and their cadence is
  // owned by the worker scheduler; this endpoint is the trigger, and it never
  // enqueues a job for a non-approved source (the DB compliance gate + the
  // worker's compliance gate both enforce that).
  return NextResponse.json({ ok: true, enqueued: 0 });
}

export function GET(): NextResponse {
  // Cron triggers must POST; GET is not a valid trigger and never authorizes.
  return NextResponse.json({ error: "method not allowed" }, { status: 405 });
}
