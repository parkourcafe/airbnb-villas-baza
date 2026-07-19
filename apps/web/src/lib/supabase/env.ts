import { z } from "zod";

/**
 * Public Supabase configuration for the browser, edge middleware and server.
 *
 * These read `process.env.NEXT_PUBLIC_*` by their literal names so Next inlines
 * them into the client/edge bundles. Reads happen inside the function (never at
 * module scope) so a missing value fails only when a client is constructed, not
 * at import/build time.
 */
const schema = z.object({
  url: z.string().url(),
  publishableKey: z.string().min(1),
});

export interface PublicSupabaseEnv {
  url: string;
  publishableKey: string;
}

export function publicSupabaseEnv(): PublicSupabaseEnv {
  return schema.parse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
