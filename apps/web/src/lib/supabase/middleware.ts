import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@bai/db";
import { sanitizeInternalPath } from "@bai/domain";
import { publicSupabaseEnv } from "./env";

const PROTECTED_PREFIX = "/app";

/**
 * Refresh the auth session on every request and guard the protected area.
 * Unauthenticated requests to `/app/*` are redirected to `/login` with a
 * sanitized `next` target (open-redirect safe).
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = publicSupabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANT: getUser() revalidates the token; do not trust getSession() here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (path.startsWith(PROTECTED_PREFIX) && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set(
      "next",
      sanitizeInternalPath(path + request.nextUrl.search),
    );
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
