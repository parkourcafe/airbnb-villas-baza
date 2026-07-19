"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ImportSource } from "@bai/db";
import { Button, Input } from "@bai/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function ImportWizard({
  organizationId,
  datasetId,
  userId,
  sources,
}: {
  organizationId: string;
  datasetId: string;
  userId: string;
  sources: ImportSource[];
}) {
  const router = useRouter();
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError("Choose a CSV file to import.");
      return;
    }
    if (!sourceId) {
      setError("Choose a source.");
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const checksum = await sha256Hex(file);

        const presignRes = await fetch("/api/imports/presign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ filename: file.name }),
        });
        if (!presignRes.ok) throw new Error("could not start upload");
        const { path, token } = (await presignRes.json()) as {
          path: string;
          token: string;
        };

        const upload = await supabase.storage
          .from("import-files")
          .uploadToSignedUrl(path, token, file);
        if (upload.error) throw upload.error;

        const { data, error: insertError } = await supabase
          .from("imports")
          .insert({
            organization_id: organizationId,
            dataset_id: datasetId,
            source_id: sourceId,
            input_object_path: path,
            original_filename: file.name,
            file_checksum: checksum,
            requested_by: userId,
            status: "uploaded",
          })
          .select("id")
          .single();
        if (insertError) throw insertError;

        router.push(`/app/imports/${data.id}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "import failed");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="source" className="text-sm font-medium">
          Source
        </label>
        <select
          id="source"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="file" className="text-sm font-medium">
          CSV file
        </label>
        <Input
          id="file"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-muted-foreground">
          Required headers: source_key, external_id, observed_at,
          observation_status. Processing is asynchronous.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || sources.length === 0}>
        {pending ? "Uploading…" : "Upload and import"}
      </Button>
    </form>
  );
}
