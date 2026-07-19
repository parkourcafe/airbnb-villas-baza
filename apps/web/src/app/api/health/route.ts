import { NextResponse } from "next/server";

/**
 * Liveness endpoint. Returns no secrets and does not touch the database.
 * A readiness endpoint that checks dependencies is added alongside them.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "web",
    milestone: 0,
  });
}
