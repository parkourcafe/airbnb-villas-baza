import postgres, { type Sql } from "postgres";

/**
 * Direct Postgres access for the worker. The worker performs privileged
 * operations on the `private` schema (job claim, raw observations) that are not
 * reachable through the Data API, so it connects to Postgres directly with a
 * server-only connection string. Created lazily; never at module scope.
 */
let client: Sql | undefined;

export function getSql(databaseUrl: string): Sql {
  if (!client) {
    client = postgres(databaseUrl, {
      max: 5,
      idle_timeout: 20,
      prepare: true,
    });
  }
  return client;
}

export async function closeSql(): Promise<void> {
  if (client) {
    await client.end({ timeout: 5 });
    client = undefined;
  }
}
