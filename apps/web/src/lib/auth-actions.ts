"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";

/** Sign the current user out and return them to the login page. */
export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
