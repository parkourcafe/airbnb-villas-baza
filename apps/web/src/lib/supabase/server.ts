import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@bai/db";
import { publicSupabaseEnv } from "./env";

/**
 * Supabase client for React Server Components, Server Actions and Route
 * Handlers. It is RLS-scoped to the signed-in user (via the anon/publishable
 * key + the user's session cookies). Created per request; never cached.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = publicSupabaseEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `setAll` was called from a Server Component, which cannot mutate
          // cookies. The middleware refreshes the session cookie instead.
        }
      },
    },
  });
}
