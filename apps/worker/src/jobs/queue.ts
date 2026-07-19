import type { Sql } from "postgres";

export interface CollectionJob {
  id: string;
  collection_run_id: string | null;
  job_type: string;
  status: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

/**
 * Claim the next queued job atomically via `private.claim_collection_job`
 * (FOR UPDATE SKIP LOCKED). Returns null when nothing is claimable, so multiple
 * workers never process the same job.
 */
export async function claimJob(
  sql: Sql,
  workerId: string,
): Promise<CollectionJob | null> {
  const rows = await sql<CollectionJob[]>`
    select * from private.claim_collection_job(${workerId})
  `;
  const job = rows[0];
  return job && job.id ? job : null;
}

export async function heartbeat(
  sql: Sql,
  jobId: string,
  workerId: string,
  progress: { current?: number; total?: number; stage?: string } = {},
): Promise<void> {
  await sql`
    select private.heartbeat_collection_job(
      ${jobId}, ${workerId},
      ${progress.current ?? null}, ${progress.total ?? null}, ${progress.stage ?? null}
    )
  `;
}

export async function completeJob(
  sql: Sql,
  jobId: string,
  status: "succeeded" | "failed",
  errorMessage?: string,
): Promise<void> {
  await sql`
    update private.collection_jobs
    set status = ${status},
        finished_at = now(),
        last_error_message = ${errorMessage ?? null}
    where id = ${jobId}
  `;
}

/**
 * Return stale running jobs (heartbeat older than the timeout) to the queue if
 * they can still be retried; otherwise fail them permanently.
 */
export async function recoverStaleJobs(
  sql: Sql,
  staleSeconds = 300,
): Promise<number> {
  const rows = await sql<{ id: string }[]>`
    update private.collection_jobs
    set status = case when attempts < max_attempts then 'retry_wait' else 'failed' end,
        locked_by = null
    where status = 'running'
      and heartbeat_at < now() - (${staleSeconds} || ' seconds')::interval
    returning id
  `;
  return rows.length;
}
