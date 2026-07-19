import type { Database } from "../generated/database.types";
import type { DbClient } from "./tenancy";

type ImportStatus = Database["public"]["Enums"]["import_status"];

export interface ImportSummary {
  id: string;
  status: ImportStatus;
  originalFilename: string | null;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  duplicateRows: number;
  createdAt: string;
  finishedAt: string | null;
}

export interface ImportRejectionRow {
  rowNumber: number;
  errorCode: string;
  errorMessage: string | null;
}

const IMPORT_COLUMNS =
  "id, status, original_filename, total_rows, accepted_rows, rejected_rows, duplicate_rows, created_at, finished_at";

interface ImportRow {
  id: string;
  status: ImportStatus;
  original_filename: string | null;
  total_rows: number;
  accepted_rows: number;
  rejected_rows: number;
  duplicate_rows: number;
  created_at: string;
  finished_at: string | null;
}

function mapImport(row: ImportRow): ImportSummary {
  return {
    id: row.id,
    status: row.status,
    originalFilename: row.original_filename,
    totalRows: row.total_rows,
    acceptedRows: row.accepted_rows,
    rejectedRows: row.rejected_rows,
    duplicateRows: row.duplicate_rows,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  };
}

export async function listImports(
  client: DbClient,
  organizationId: string,
): Promise<ImportSummary[]> {
  const { data, error } = await client
    .from("imports")
    .select(IMPORT_COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<ImportRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapImport);
}

export async function getImport(
  client: DbClient,
  importId: string,
): Promise<ImportSummary | null> {
  const { data, error } = await client
    .from("imports")
    .select(IMPORT_COLUMNS)
    .eq("id", importId)
    .maybeSingle<ImportRow>();
  if (error) throw error;
  return data ? mapImport(data) : null;
}

export interface ImportSource {
  id: string;
  key: string;
  displayName: string;
  accessMode: string;
}

export async function listImportSources(
  client: DbClient,
): Promise<ImportSource[]> {
  const { data, error } = await client
    .from("import_sources")
    .select("id, key, display_name, access_mode")
    .order("display_name", { ascending: true })
    .returns<
      { id: string; key: string; display_name: string; access_mode: string }[]
    >();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    key: row.key,
    displayName: row.display_name,
    accessMode: row.access_mode,
  }));
}

export async function getImportRejections(
  client: DbClient,
  importId: string,
  limit = 500,
): Promise<ImportRejectionRow[]> {
  const { data, error } = await client
    .from("import_rejections")
    .select("row_number, error_code, error_message")
    .eq("import_id", importId)
    .order("row_number", { ascending: true })
    .limit(limit)
    .returns<
      { row_number: number; error_code: string; error_message: string | null }[]
    >();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    rowNumber: row.row_number,
    errorCode: row.error_code,
    errorMessage: row.error_message,
  }));
}
