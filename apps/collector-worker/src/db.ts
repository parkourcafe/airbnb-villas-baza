import postgres, { type Sql } from "postgres";

/**
 * Direct Postgres access for the local collector. Uses a server-only connection
 * string; created lazily, never at module scope. No Airbnb credentials are ever
 * stored here — only the BAI database connection.
 */
let client: Sql | undefined;

export function getSql(databaseUrl: string): Sql {
  if (!client) {
    client = postgres(databaseUrl, { max: 4, idle_timeout: 20, prepare: true });
  }
  return client;
}

export async function closeSql(): Promise<void> {
  if (client) {
    await client.end({ timeout: 5 });
    client = undefined;
  }
}
