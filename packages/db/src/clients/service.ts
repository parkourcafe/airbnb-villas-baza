import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../generated/database.types";
import { readServiceSupabaseEnv } from "../env";
import { createLazySingleton } from "../lazy";

export type ServiceClient = SupabaseClient<Database>;

/**
 * The service-role client bypasses RLS and must only ever run on the server
 * (worker, route handlers, admin paths). It is created lazily and refuses to be
 * constructed in a browser context. The service role key is never sent to the
 * browser.
 */
export const getServiceClient = createLazySingleton<ServiceClient>(() => {
  if (typeof (globalThis as { window?: unknown }).window !== "undefined") {
    throw new Error(
      "the Supabase service-role client must never be created in the browser",
    );
  }
  const env = readServiceSupabaseEnv();
  return createClient<Database>(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
});
