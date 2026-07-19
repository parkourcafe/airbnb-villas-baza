import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getServiceClient } from "@bai/db";

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

  // Enqueue due jobs only. `enqueue_due_collections` (service-role) creates a
  // run + job for every schedule whose cadence has elapsed and whose source is
  // approved and automation-allowed. The DB compliance gate on collection_runs
  // guarantees a non-approved source can never be enqueued.
  try {
    const { data, error } = await getServiceClient().rpc(
      "enqueue_due_collections",
    );
    if (error) throw error;
    return NextResponse.json({ ok: true, enqueued: data ?? 0 });
  } catch {
    return NextResponse.json({ error: "enqueue failed" }, { status: 500 });
  }
}

export function GET(): NextResponse {
  // Cron triggers must POST; GET is not a valid trigger and never authorizes.
  return NextResponse.json({ error: "method not allowed" }, { status: 405 });
}
