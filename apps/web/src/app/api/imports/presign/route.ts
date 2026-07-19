import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@bai/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ filename: z.string().min(1).max(255) });

/**
 * Return a signed upload URL for the private `import-files` bucket. File names
 * are not trusted: the object key is server-generated (`<user>/<uuid>/<name>`).
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const safeName = parsed.data.filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-100);
  const objectPath = `${user.id}/${crypto.randomUUID()}/${safeName}`;

  const service = getServiceClient();
  const { data, error } = await service.storage
    .from("import-files")
    .createSignedUploadUrl(objectPath);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ path: data.path, token: data.token });
}
