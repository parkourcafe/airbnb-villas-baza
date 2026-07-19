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
