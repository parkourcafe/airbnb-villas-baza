import { getImportRejections } from "@bai/db";
import { toCsv } from "@bai/reporting";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Download an import's rejected rows as CSV. RLS scopes the rows to the caller's
 * organization; cells are escaped against spreadsheet formula injection.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("unauthorized", { status: 401 });
  }

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const rejections = await getImportRejections(supabase, id, 10_000);

  const csv = toCsv(
    rejections.map((r) => [r.rowNumber, r.errorCode, r.errorMessage ?? ""]),
    ["row_number", "error_code", "error_message"],
  );

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="import-${id}-rejections.csv"`,
    },
  });
}
