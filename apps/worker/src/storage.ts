import { createClient } from "@supabase/supabase-js";

/**
 * Build a CSV loader that downloads an uploaded file from the private
 * `import-files` bucket using the service-role key (server-only). Returns the
 * file contents as text.
 */
export function createCsvLoader(
  supabaseUrl: string,
  serviceRoleKey: string,
): (objectPath: string) => Promise<string> {
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return async (objectPath: string): Promise<string> => {
    const { data, error } = await client.storage
      .from("import-files")
      .download(objectPath);
    if (error) throw error;
    return data.text();
  };
}

/**
 * Build a CSV uploader that writes a generated report/export to the private
 * `reports` bucket using the service-role key (server-only).
 */
export function createCsvUploader(
  supabaseUrl: string,
  serviceRoleKey: string,
): (objectPath: string, content: string) => Promise<void> {
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return async (objectPath: string, content: string): Promise<void> => {
    const { error } = await client.storage
      .from("reports")
      .upload(objectPath, content, {
        contentType: "text/csv; charset=utf-8",
        upsert: true,
      });
    if (error) throw error;
  };
}
