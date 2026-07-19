import { getServiceClient } from "@bai/db";
import { loadTenancyContext } from "@/lib/tenancy";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Redirect to a short-lived signed URL for a ready report's CSV (7.3). The
 * report row is first read with the RLS-scoped client, so only a member of the
 * owning organization can obtain a link; the signed URL itself is minted with
 * the service role and expires quickly.
 */
export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const ctx = await loadTenancyContext();
  if (!ctx) return new Response("unauthorized", { status: 401 });

  // RLS ensures this returns a row only for a member of the owning org.
  const supabase = await createSupabaseServerClient();
  const { data: report, error } = await supabase
    .from("reports")
    .select("id, status, output_object_path")
    .eq("id", id)
    .maybeSingle();
  if (error || !report) return new Response("not found", { status: 404 });
  if (report.status !== "ready" || !report.output_object_path) {
    return new Response("report is not ready", { status: 409 });
  }

  const { data: signed, error: signError } = await getServiceClient()
    .storage.from("reports")
    .createSignedUrl(report.output_object_path, SIGNED_URL_TTL_SECONDS);
  if (signError || !signed) {
    return new Response("could not sign download", { status: 500 });
  }
  return Response.redirect(signed.signedUrl, 302);
}
