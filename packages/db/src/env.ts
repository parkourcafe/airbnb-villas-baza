import { z } from "zod";

/**
 * Environment validation for Supabase access. Read lazily (inside these
 * functions), never at module scope, so importing this package has no side
 * effects and a missing variable fails fast only when a client is actually
 * constructed. Server-only variables never carry the `NEXT_PUBLIC_` prefix.
 */

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export interface PublicSupabaseEnv {
  url: string;
  publishableKey: string;
}

export function readPublicSupabaseEnv(
  env: NodeJS.ProcessEnv = process.env,
): PublicSupabaseEnv {
  const parsed = publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return {
    url: parsed.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: parsed.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

const serviceEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export interface ServiceSupabaseEnv {
  url: string;
  serviceRoleKey: string;
}

export function readServiceSupabaseEnv(
  env: NodeJS.ProcessEnv = process.env,
): ServiceSupabaseEnv {
  const parsed = serviceEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  });
  return {
    url: parsed.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
  };
}
