import type { NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

// Next 16 renamed the `middleware` convention to `proxy`. This refreshes the
// Supabase session on every request and guards the protected `/app` area.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on everything except static assets and images.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
