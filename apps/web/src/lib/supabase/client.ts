"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@bai/db";
import { publicSupabaseEnv } from "./env";

/** Supabase client for Client Components (browser). Uses the publishable key. */
export function createSupabaseBrowserClient() {
  const { url, publishableKey } = publicSupabaseEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
